import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const schema = z.object({
  routeId: z.number().int().positive(),
  busId: z.number().int().positive(),
  driverId: z.number().int().positive(),
  helperId: z.number().int().positive().optional(),
  branchId: z.number().int().positive(),
  salidaAt: z.string().datetime(),
  llegadaEstimadaAt: z.string().datetime().optional(),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { branchId, estado, fecha } = req.query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { tenantId: req.tenant!.id };

  if (branchId) where['branchId'] = parseInt(branchId as string);
  if (estado) where['estado'] = estado;
  if (fecha) {
    const d = new Date(fecha as string);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    where['salidaAt'] = { gte: d, lt: next };
  }

  const schedules = await db.schedule.findMany({
    where,
    include: {
      route: { select: { id: true, destino: true, precioSugerido: true, precioMaximoAtt: true } },
      bus: { select: { id: true, placa: true, seatTemplate: { select: { capacidadTotal: true, layout: true, config: true } } } },
      driver: { select: { id: true, nombre: true } },
      helper: { select: { id: true, nombre: true } },
      branch: { select: { id: true, nombre: true, ciudad: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { salidaAt: 'asc' },
  });
  res.json(schedules);
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const schedule = await db.schedule.findFirst({
    where: { id, tenantId: req.tenant!.id },
    include: {
      route: true,
      bus: { include: { seatTemplate: true } },
      driver: true,
      helper: true,
      branch: true,
      tickets: { select: { id: true, asientoNumero: true, estado: true, pasajeroNombre: true } },
    },
  });
  if (!schedule) { res.status(404).json({ message: 'Habilitación no encontrada' }); return; }
  res.json(schedule);
});

router.post('/', requireRole('admin', 'supervisor'), async (req: Request, res: Response): Promise<void> => {
  const data = schema.parse(req.body);
  const salidaAt = new Date(data.salidaAt);
  if (salidaAt < new Date()) { res.status(400).json({ message: 'La fecha de salida no puede ser en el pasado' }); return; }

  const [route, bus, driver] = await Promise.all([
    db.route.findFirst({ where: { id: data.routeId, tenantId: req.tenant!.id, activo: true } }),
    db.bus.findFirst({ where: { id: data.busId, tenantId: req.tenant!.id, activo: true } }),
    db.driver.findFirst({ where: { id: data.driverId, tenantId: req.tenant!.id, activo: true } }),
  ]);

  if (!route) { res.status(400).json({ message: 'Ruta no encontrada o inactiva' }); return; }
  if (!bus) { res.status(400).json({ message: 'Bus no encontrado o inactivo' }); return; }
  if (!driver) { res.status(400).json({ message: 'Chofer no encontrado o inactivo' }); return; }
  if (driver.licenciaVence && new Date(driver.licenciaVence) < new Date()) {
    res.status(400).json({ message: 'El chofer tiene la licencia vencida' }); return;
  }

  const schedule = await db.schedule.create({
    data: {
      routeId: data.routeId,
      busId: data.busId,
      driverId: data.driverId,
      helperId: data.helperId,
      branchId: data.branchId,
      salidaAt,
      llegadaEstimadaAt: data.llegadaEstimadaAt ? new Date(data.llegadaEstimadaAt) : undefined,
      tenantId: req.tenant!.id,
      estado: 'Programada',
      createdBy: req.user ? parseInt(req.user.sub) : undefined,
    },
  });
  res.status(201).json(schedule);
});

router.patch('/:id/estado', requireRole('admin', 'supervisor'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { estado } = z.object({
    estado: z.enum(['Programada', 'Habilitada', 'EnCurso', 'Finalizada', 'Cancelada']),
  }).parse(req.body);
  const result = await db.schedule.updateMany({ where: { id, tenantId: req.tenant!.id }, data: { estado } });
  if (result.count === 0) { res.status(404).json({ message: 'Habilitación no encontrada' }); return; }
  res.json({ message: 'Estado actualizado', estado });
});

router.get('/:id/manifiesto', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const schedule = await db.schedule.findFirst({
    where: { id, tenantId: req.tenant!.id },
    include: {
      route: { select: { destino: true } },
      bus: { select: { placa: true } },
      driver: { select: { nombre: true } },
      helper: { select: { nombre: true } },
      branch: { select: { nombre: true, ciudad: true } },
      tickets: {
        select: { asientoNumero: true, pasajeroNombre: true, pasajeroRut: true, precio: true, estado: true },
        orderBy: { asientoNumero: 'asc' },
      },
    },
  });
  if (!schedule) { res.status(404).json({ message: 'Habilitación no encontrada' }); return; }
  res.json(schedule);
});

export default router;
