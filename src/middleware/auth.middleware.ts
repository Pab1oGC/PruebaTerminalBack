import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types/index';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token requerido' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;

    // Validación crítica: tenant del JWT debe coincidir con tenant de la URL
    if (req.tenant && payload.tenantCode !== req.tenant.codigo) {
      res.status(403).json({ message: 'Acceso denegado' });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

export function requireRole(...roles: JwtPayload['rol'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ message: 'Permisos insuficientes' });
      return;
    }
    next();
  };
}
