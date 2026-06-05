import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const schema = z.object({
  nombre: z.string().min(1).max(128),
  rut: z.string().min(1).max(20),
  telefono: z.string().max(20).optional(),
  licenciaVence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  activo: z.boolean().optional().default(true),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const today = new Date();
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + 30);

  const drivers = await db.driver.findMany({
    where: { tenantId: req.tenant!.id },
    orderBy: { nombre: 'asc' },
  });

  const result = drivers.map((d) => ({
    ...d,
    licenciaAlerta: d.licenciaVence
      ? new Date(d.licenciaVence) <= alertDate
        ? new Date(d.licenciaVence) < today ? 'vencida' : 'proxima'
        : null
      : null,
  }));

  res.json(result);
});

router.post('/', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const data = schema.parse(req.body);
  const existing = await db.driver.findUnique({ where: { tenantId_rut: { tenantId: req.tenant!.id, rut: data.rut } } });
  if (existing) { res.status(400).json({ message: 'Ya existe un chofer con ese RUT' }); return; }
  const driver = await db.driver.create({
    data: {
      nombre: data.nombre,
      rut: data.rut,
      telefono: data.telefono,
      licenciaVence: data.licenciaVence ? new Date(data.licenciaVence) : undefined,
      activo: data.activo,
      tenantId: req.tenant!.id,
    },
  });
  res.status(201).json(driver);
});

router.put('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const raw = schema.partial().parse(req.body);
  const result = await db.driver.updateMany({
    where: { id, tenantId: req.tenant!.id },
    data: {
      nombre: raw.nombre,
      rut: raw.rut,
      telefono: raw.telefono,
      licenciaVence: raw.licenciaVence ? new Date(raw.licenciaVence) : undefined,
      activo: raw.activo,
    },
  });
  if (result.count === 0) { res.status(404).json({ message: 'Chofer no encontrado' }); return; }
  res.json(await db.driver.findUnique({ where: { id } }));
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.driver.updateMany({ where: { id, tenantId: req.tenant!.id }, data: { activo: false } });
  res.json({ message: 'Chofer desactivado' });
});

export default router;
