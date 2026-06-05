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
  activo: z.boolean().optional().default(true),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const helpers = await db.helper.findMany({
    where: { tenantId: req.tenant!.id },
    orderBy: { nombre: 'asc' },
  });
  res.json(helpers);
});

router.post('/', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const data = schema.parse(req.body);
  const existing = await db.helper.findUnique({ where: { tenantId_rut: { tenantId: req.tenant!.id, rut: data.rut } } });
  if (existing) { res.status(400).json({ message: 'Ya existe un ayudante con ese RUT' }); return; }
  const helper = await db.helper.create({ data: { ...data, tenantId: req.tenant!.id } });
  res.status(201).json(helper);
});

router.put('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const data = schema.partial().parse(req.body);
  const result = await db.helper.updateMany({ where: { id, tenantId: req.tenant!.id }, data });
  if (result.count === 0) { res.status(404).json({ message: 'Ayudante no encontrado' }); return; }
  res.json(await db.helper.findUnique({ where: { id } }));
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.helper.updateMany({ where: { id, tenantId: req.tenant!.id }, data: { activo: false } });
  res.json({ message: 'Ayudante desactivado' });
});

export default router;
