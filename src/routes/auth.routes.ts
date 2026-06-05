import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import crypto from 'crypto';
import { z } from 'zod/v4';
import { db } from '../lib/db';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth.middleware';
import { JwtPayload } from '../types/index';

const router = Router({ mergeParams: true });

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

function signAccessToken(payload: Omit<JwtPayload, never>): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip ?? '0.0.0.0';
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const tenant = req.tenant!;
  const ip = getIp(req);
  const userAgent = req.headers['user-agent'] ?? '';

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Datos inválidos' }); return; }

  const { email, password } = parsed.data;

  const logAttempt = (exitoso: boolean) =>
    db.loginAttempt.create({
      data: { tenantId: tenant.id, codigoEmpresa: tenant.codigo, username: email, ipAddress: ip, userAgent, exitoso },
    }).catch(() => {});

  const recentIpFails = await db.loginAttempt.count({
    where: { ipAddress: ip, exitoso: false, createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
  });
  if (recentIpFails >= 20) { res.status(429).json({ message: 'Demasiados intentos. Intente más tarde.' }); return; }

  const user = await db.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email } } });

  if (!user) { await logAttempt(false); res.status(401).json({ message: 'Credenciales incorrectas' }); return; }
  if (user.estado !== 'Activo') { await logAttempt(false); res.status(401).json({ message: 'Usuario inactivo o suspendido' }); return; }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    res.status(423).json({ message: `Cuenta bloqueada. Intente en ${minutes} minuto(s).` }); return;
  }

  const passwordValid = await argon2.verify(user.passwordHash, password);
  if (!passwordValid) {
    const fails = user.failedLoginAttempts + 1;
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: fails, lockedUntil: fails >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000) : null },
    });
    await logAttempt(false);
    res.status(401).json({ message: 'Credenciales incorrectas' }); return;
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip } });

  const rawRefreshToken = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.refreshToken.create({
    data: { tenantId: tenant.id, userId: user.id, tokenHash: hashToken(rawRefreshToken), ipAddress: ip, userAgent, expiresAt },
  });

  const jwtPayload: JwtPayload = {
    sub: String(user.id),
    tenantId: tenant.id,
    tenantCode: tenant.codigo,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol as JwtPayload['rol'],
    branchId: user.branchId,
  };

  const accessToken = signAccessToken(jwtPayload);
  await logAttempt(true);

  res.cookie('refresh_token', rawRefreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: `/api/t/${tenant.codigo}/auth`,
    expires: expiresAt,
  });

  res.json({
    accessToken,
    user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, branchId: user.branchId },
    tenant: { id: tenant.id, codigo: tenant.codigo, nombre: tenant.nombre },
  });
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const tenant = req.tenant!;
  const rawToken = req.cookies?.refresh_token as string | undefined;

  if (!rawToken) { res.status(401).json({ message: 'Sesión expirada' }); return; }

  const tokenHash = hashToken(rawToken);
  const stored = await db.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.tenantId !== tenant.id || stored.revokedAt || stored.expiresAt < new Date()) {
    res.status(401).json({ message: 'Sesión inválida o expirada' }); return;
  }

  const user = await db.user.findUnique({ where: { id: stored.userId } });
  if (!user || user.estado !== 'Activo') { res.status(401).json({ message: 'Usuario inactivo' }); return; }

  await db.refreshToken.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } });

  const jwtPayload: JwtPayload = {
    sub: String(user.id),
    tenantId: tenant.id,
    tenantCode: tenant.codigo,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol as JwtPayload['rol'],
    branchId: user.branchId,
  };

  res.json({
    accessToken: signAccessToken(jwtPayload),
    user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, branchId: user.branchId },
  });
});

router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const rawToken = req.cookies?.refresh_token as string | undefined;
  if (rawToken) {
    await db.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken) },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie('refresh_token', { path: `/api/t/${req.tenant!.codigo}/auth` });
  res.json({ message: 'Sesión cerrada' });
});

router.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.json({ user: req.user });
});

export default router;
