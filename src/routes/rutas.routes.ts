import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const schema = z.object({
  origenBranchId: z.number().int().positive(),
  destino: z.string().min(1).max(128),
  distanciaKm: z.number().positive().optional(),
  precioMaximoAtt: z.number().positive(),
  precioSugerido: z.number().positive(),
  activo: z.boolean().optional().default(true),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const rutas = await db.route.findMany({
    where: { tenantId: req.tenant!.id },
    include: { origenBranch: { select: { id: true, nombre: true, ciudad: true } } },
    orderBy: [{ origenBranch: { nombre: 'asc' } }, { destino: 'asc' }],
  });
  res.json(rutas);
});

router.post('/', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const data = schema.parse(req.body);
  if (data.precioSugerido > data.precioMaximoAtt) {
    res.status(400).json({ message: 'El precio sugerido no puede superar el precio máximo ATT' }); return;
  }
  const ruta = await db.route.create({ data: { ...data, tenantId: req.tenant!.id } });
  res.status(201).json(ruta);
});

router.put('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const data = schema.partial().parse(req.body);
  if (data.precioSugerido && data.precioMaximoAtt && data.precioSugerido > data.precioMaximoAtt) {
    res.status(400).json({ message: 'El precio sugerido no puede superar el precio máximo ATT' }); return;
  }
  const result = await db.route.updateMany({ where: { id, tenantId: req.tenant!.id }, data });
  if (result.count === 0) { res.status(404).json({ message: 'Ruta no encontrada' }); return; }
  res.json(await db.route.findUnique({ where: { id }, include: { origenBranch: true } }));
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.route.updateMany({ where: { id, tenantId: req.tenant!.id }, data: { activo: false } });
  res.json({ message: 'Ruta desactivada' });
});

export default router;
