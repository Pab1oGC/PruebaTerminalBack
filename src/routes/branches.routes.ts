import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const schema = z.object({
  nombre: z.string().min(1).max(128),
  ciudad: z.string().min(1).max(128),
  activo: z.boolean().optional().default(true),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const branches = await db.branch.findMany({
    where: { tenantId: req.tenant!.id },
    orderBy: { nombre: 'asc' },
  });
  res.json(branches);
});

router.post('/', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const data = schema.parse(req.body);
  const branch = await db.branch.create({ data: { ...data, tenantId: req.tenant!.id } });
  res.status(201).json(branch);
});

router.put('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const data = schema.partial().parse(req.body);
  const branch = await db.branch.updateMany({ where: { id, tenantId: req.tenant!.id }, data });
  if (branch.count === 0) { res.status(404).json({ message: 'Sucursal no encontrada' }); return; }
  res.json(await db.branch.findUnique({ where: { id } }));
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.branch.updateMany({ where: { id, tenantId: req.tenant!.id }, data: { activo: false } });
  res.json({ message: 'Sucursal desactivada' });
});

export default router;
