import { Request, Response, NextFunction } from 'express';
import { db } from '../lib/db';

export async function resolveTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tenantCode = req.params['tenantCode'] as string;
  if (!tenantCode) {
    res.status(400).json({ message: 'Código de empresa requerido' });
    return;
  }

  const tenant = await db.tenant.findUnique({ where: { codigo: tenantCode } });

  if (!tenant) {
    res.status(404).json({ message: 'Empresa no encontrada' });
    return;
  }

  if (tenant.estado === 'Suspended') {
    res.status(403).json({ message: 'Cuenta suspendida. Contacte al soporte.' });
    return;
  }

  if (tenant.estado === 'Archived') {
    res.status(403).json({ message: 'Cuenta archivada.' });
    return;
  }

  req.tenant = tenant;
  next();
}
