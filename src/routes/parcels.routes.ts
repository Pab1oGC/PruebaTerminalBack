import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const schema = z.object({
  scheduleId: z.number().int().positive(),
  remitenteNombre: z.string().min(1).max(128),
  remitenteCi: z.string().min(1).max(20),
  remitenteTel: z.string().max(20).optional(),
  destinatarioNombre: z.string().min(1).max(128),
  destinatarioCi: z.string().min(1).max(20),
  destinatarioTel: z.string().max(20).optional(),
  descripcion: z.string().min(1),
  pesoKg: z.number().positive().optional(),
  precio: z.number().positive(),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { scheduleId, estado } = req.query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { tenantId: req.tenant!.id };
  if (scheduleId) where['scheduleId'] = parseInt(scheduleId as string);
  if (estado) where['estado'] = estado;

  const parcels = await db.parcel.findMany({
    where,
    include: {
      schedule: {
        select: { id: true, salidaAt: true, route: { select: { destino: true } }, branch: { select: { nombre: true } } },
      },
    },
    orderBy: { registradoAt: 'desc' },
    take: 200,
  });
  res.json(parcels);
});

router.get('/schedule/:scheduleId', async (req: Request, res: Response): Promise<void> => {
  const scheduleId = parseInt(req.params.scheduleId as string);
  const parcels = await db.parcel.findMany({
    where: { scheduleId, tenantId: req.tenant!.id },
    orderBy: { registradoAt: 'asc' },
  });
  res.json(parcels);
});

router.post('/', requireRole('admin', 'supervisor', 'boletero'), async (req: Request, res: Response): Promise<void> => {
  const data = schema.parse(req.body);
  const userId = req.user ? parseInt(req.user.sub) : undefined;

  const schedule = await db.schedule.findFirst({
    where: { id: data.scheduleId, tenantId: req.tenant!.id },
  });
  if (!schedule) { res.status(404).json({ message: 'Habilitación no encontrada' }); return; }
  if (schedule.estado === 'Finalizada' || schedule.estado === 'Cancelada') {
    res.status(400).json({ message: 'La habilitación no está disponible' }); return;
  }

  const parcel = await db.parcel.create({
    data: {
      scheduleId: data.scheduleId,
      remitenteNombre: data.remitenteNombre,
      remitenteCi: data.remitenteCi,
      remitenteTel: data.remitenteTel,
      destinatarioNombre: data.destinatarioNombre,
      destinatarioCi: data.destinatarioCi,
      destinatarioTel: data.destinatarioTel,
      descripcion: data.descripcion,
      pesoKg: data.pesoKg,
      precio: data.precio,
      tenantId: req.tenant!.id,
      registradoPor: userId,
    },
  });
  res.status(201).json(parcel);
});

router.patch('/:id/estado', requireRole('admin', 'supervisor', 'boletero'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { estado } = z.object({
    estado: z.enum(['Embarcada', 'Entregada']),
  }).parse(req.body);

  const parcel = await db.parcel.findFirst({ where: { id, tenantId: req.tenant!.id } });
  if (!parcel) { res.status(404).json({ message: 'Encomienda no encontrada' }); return; }

  if (estado === 'Embarcada' && parcel.estado !== 'Registrada') {
    res.status(400).json({ message: 'Solo se puede embarcar una encomienda en estado Registrada' }); return;
  }
  if (estado === 'Entregada' && parcel.estado !== 'Embarcada') {
    res.status(400).json({ message: 'Solo se puede entregar una encomienda en estado Embarcada' }); return;
  }

  const updated = await db.parcel.update({ where: { id }, data: { estado } });
  res.json(updated);
});

router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const parcel = await db.parcel.findFirst({ where: { id, tenantId: req.tenant!.id } });
  if (!parcel) { res.status(404).json({ message: 'Encomienda no encontrada' }); return; }
  if (parcel.estado !== 'Registrada') {
    res.status(400).json({ message: 'Solo se pueden cancelar encomiendas en estado Registrada' }); return;
  }
  await db.parcel.delete({ where: { id } });
  res.json({ message: 'Encomienda cancelada' });
});

export default router;
