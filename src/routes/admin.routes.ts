import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { db } from '../lib/db';
import { env } from '../config/env';

const router = Router();

// ─── Platform Admin Auth Middleware ───────────────────────────────────────────

interface AdminJwt { sub: string; nombre: string; role: 'platform_admin' }

function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ message: 'Token requerido' }); return; }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.platformAdminSecret) as AdminJwt;
    if (payload.role !== 'platform_admin') { res.status(403).json({ message: 'Acceso denegado' }); return; }
    (req as Request & { adminUser: AdminJwt }).adminUser = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }).parse(req.body);

  const admin = await db.platformAdmin.findUnique({ where: { username } });
  if (!admin || !admin.activo) { res.status(401).json({ message: 'Credenciales inválidas' }); return; }

  const valid = await argon2.verify(admin.passwordHash, password);
  if (!valid) { res.status(401).json({ message: 'Credenciales inválidas' }); return; }

  const token = jwt.sign(
    { sub: String(admin.id), nombre: admin.nombre, role: 'platform_admin' },
    env.platformAdminSecret,
    { expiresIn: '8h' }
  );
  res.json({ token, admin: { id: admin.id, username: admin.username, nombre: admin.nombre, email: admin.email } });
});

// ─── Tenants ─────────────────────────────────────────────────────────────────

router.get('/tenants', requirePlatformAdmin, async (_req: Request, res: Response): Promise<void> => {
  const tenants = await db.tenant.findMany({
    include: {
      _count: { select: { users: true, schedules: true, tickets: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tenants);
});

router.get('/tenants/:id', requirePlatformAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      branches: { select: { id: true, nombre: true, ciudad: true, activo: true } },
      users: { select: { id: true, nombre: true, email: true, rol: true, estado: true, lastLoginAt: true }, take: 20 },
      _count: { select: { users: true, schedules: true, tickets: true, parcels: true } },
    },
  });
  if (!tenant) { res.status(404).json({ message: 'Tenant no encontrado' }); return; }
  res.json(tenant);
});

const createTenantSchema = z.object({
  codigo: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  nombre: z.string().min(1).max(128),
  emailContacto: z.string().email(),
  telefonoContacto: z.string().max(20).optional(),
  notasAdmin: z.string().optional(),
  adminNombre: z.string().min(1).max(128),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  branchNombre: z.string().min(1).max(128).default('Casa Matriz'),
  branchCiudad: z.string().min(1).max(128),
});

router.post('/tenants', requirePlatformAdmin, async (req: Request, res: Response): Promise<void> => {
  const data = createTenantSchema.parse(req.body);

  const exists = await db.tenant.findUnique({ where: { codigo: data.codigo } });
  if (exists) { res.status(409).json({ message: 'El código de tenant ya está en uso' }); return; }

  const passwordHash = await argon2.hash(data.adminPassword, { type: argon2.argon2id });

  const tenant = await db.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: {
        codigo: data.codigo,
        nombre: data.nombre,
        emailContacto: data.emailContacto,
        telefonoContacto: data.telefonoContacto,
        notasAdmin: data.notasAdmin,
      },
    });
    const branch = await tx.branch.create({
      data: { tenantId: t.id, nombre: data.branchNombre, ciudad: data.branchCiudad },
    });
    await tx.user.create({
      data: {
        tenantId: t.id,
        branchId: branch.id,
        email: data.adminEmail,
        passwordHash,
        nombre: data.adminNombre,
        rol: 'admin',
      },
    });
    return t;
  });

  res.status(201).json(tenant);
});

router.patch('/tenants/:id/estado', requirePlatformAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { estado, notasAdmin } = z.object({
    estado: z.enum(['Active', 'Suspended', 'Archived']),
    notasAdmin: z.string().optional(),
  }).parse(req.body);

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) { res.status(404).json({ message: 'Tenant no encontrado' }); return; }

  const now = new Date();
  const updated = await db.tenant.update({
    where: { id },
    data: {
      estado,
      ...(notasAdmin ? { notasAdmin } : {}),
      ...(estado === 'Suspended' ? { fechaSuspension: now } : {}),
      ...(estado === 'Archived' ? { fechaArchivado: now } : {}),
    },
  });
  res.json(updated);
});

router.delete('/tenants/:id', requirePlatformAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) { res.status(404).json({ message: 'Tenant no encontrado' }); return; }
  if (tenant.estado !== 'Archived') {
    res.status(400).json({ message: 'Solo se pueden eliminar tenants archivados' }); return;
  }
  await db.tenant.update({ where: { id }, data: { estado: 'Archived', notasAdmin: `[DELETED] ${tenant.notasAdmin ?? ''}` } });
  res.json({ message: 'Tenant marcado para eliminación' });
});

export default router;
