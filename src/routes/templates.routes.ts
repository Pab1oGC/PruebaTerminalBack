import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const configSchema = z.enum(['2-2', '2-1', '1-2', '1-1']);

const schema = z.object({
  nombre: z.string().min(1).max(128),
  config: configSchema,
  filas: z.number().int().min(1).max(20),
  pisos: z.number().int().min(1).max(2),
});

function generateLayout(config: string, filas: number, pisos: number) {
  const [left, right] = config.split('-').map(Number);
  let seatNum = 1;
  const floors = [];
  const filasPerPiso = Math.ceil(filas / pisos);

  for (let f = 0; f < pisos; f++) {
    const floorRows = [];
    const rowsThisFloor = f === pisos - 1 ? filas - filasPerPiso * f : filasPerPiso;
    for (let r = 0; r < rowsThisFloor; r++) {
      const seats: (number | null)[] = [];
      for (let i = 0; i < left; i++) seats.push(seatNum++);
      seats.push(null);
      for (let i = 0; i < right; i++) seats.push(seatNum++);
      floorRows.push({ seats });
    }
    floors.push({ rows: floorRows });
  }

  const capacidadTotal = filas * (left + right);
  return { layout: { floors }, capacidadTotal };
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const templates = await db.seatTemplate.findMany({
    where: { tenantId: req.tenant!.id },
    orderBy: { nombre: 'asc' },
  });
  res.json(templates);
});

router.post('/', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const { nombre, config, filas, pisos } = schema.parse(req.body);
  const { layout, capacidadTotal } = generateLayout(config, filas, pisos);
  const template = await db.seatTemplate.create({
    data: { nombre, config, pisos, layout, capacidadTotal, tenantId: req.tenant!.id },
  });
  res.status(201).json(template);
});

router.put('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { nombre, config, filas, pisos } = schema.parse(req.body);
  const { layout, capacidadTotal } = generateLayout(config, filas, pisos);
  const result = await db.seatTemplate.updateMany({
    where: { id, tenantId: req.tenant!.id },
    data: { nombre, config, pisos, layout, capacidadTotal },
  });
  if (result.count === 0) { res.status(404).json({ message: 'Plantilla no encontrada' }); return; }
  res.json(await db.seatTemplate.findUnique({ where: { id } }));
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const inUse = await db.bus.count({ where: { seatTemplateId: id, tenantId: req.tenant!.id } });
  if (inUse > 0) { res.status(400).json({ message: 'La plantilla está en uso por un bus' }); return; }
  await db.seatTemplate.deleteMany({ where: { id, tenantId: req.tenant!.id } });
  res.json({ message: 'Plantilla eliminada' });
});

export default router;
