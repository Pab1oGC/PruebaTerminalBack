import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const schema = z.object({
  placa: z.string().min(1).max(20),
  marca: z.string().max(64).optional(),
  modelo: z.string().max(64).optional(),
  anio: z.number().int().min(1990).max(2100).optional(),
  seatTemplateId: z.number().int().positive(),
  activo: z.boolean().optional().default(true),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const buses = await db.bus.findMany({
    where: { tenantId: req.tenant!.id },
    include: { seatTemplate: { select: { id: true, nombre: true, config: true, capacidadTotal: true } } },
    orderBy: { placa: 'asc' },
  });
  res.json(buses);
});

router.post('/', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const data = schema.parse(req.body);
  const template = await db.seatTemplate.findFirst({ where: { id: data.seatTemplateId, tenantId: req.tenant!.id } });
  if (!template) { res.status(400).json({ message: 'Plantilla de asientos no encontrada' }); return; }
  const bus = await db.bus.create({ data: { ...data, tenantId: req.tenant!.id } });
  res.status(201).json(bus);
});

router.put('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const data = schema.partial().parse(req.body);
  if (data.seatTemplateId) {
    const template = await db.seatTemplate.findFirst({ where: { id: data.seatTemplateId, tenantId: req.tenant!.id } });
    if (!template) { res.status(400).json({ message: 'Plantilla de asientos no encontrada' }); return; }
  }
  const result = await db.bus.updateMany({ where: { id, tenantId: req.tenant!.id }, data });
  if (result.count === 0) { res.status(404).json({ message: 'Bus no encontrado' }); return; }
  res.json(await db.bus.findUnique({ where: { id }, include: { seatTemplate: true } }));
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const inUse = await db.schedule.count({ where: { busId: id, tenantId: req.tenant!.id } });
  if (inUse > 0) { res.status(400).json({ message: 'El bus tiene habilitaciones asociadas' }); return; }
  await db.bus.updateMany({ where: { id, tenantId: req.tenant!.id }, data: { activo: false } });
  res.json({ message: 'Bus desactivado' });
});

export default router;
