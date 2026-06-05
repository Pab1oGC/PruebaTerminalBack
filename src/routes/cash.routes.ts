import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

async function buildResumen(session: { id: number; userId: number; branchId: number; saldoInicial: number; abiertaAt: Date; cerradaAt: Date | null }) {
  const timeFilter = {
    gte: session.abiertaAt,
    ...(session.cerradaAt ? { lte: session.cerradaAt } : {}),
  };
  const [ticketAgg, parcelAgg, movements] = await Promise.all([
    db.ticket.aggregate({
      where: { vendidoPor: session.userId, vendidoAt: timeFilter, metodoPago: 'Efectivo' },
      _sum: { precio: true },
    }),
    db.parcel.aggregate({
      where: { registradoPor: session.userId, registradoAt: timeFilter },
      _sum: { precio: true },
    }),
    db.cashMovement.findMany({ where: { sessionId: session.id } }),
  ]);
  const ventasBoletos = ticketAgg._sum.precio ?? 0;
  const ventasEncomiendas = parcelAgg._sum.precio ?? 0;
  const movIngresos = movements.filter(m => m.tipo === 'Ingreso').reduce((a, m) => a + m.monto, 0);
  const movEgresos = movements.filter(m => m.tipo === 'Egreso').reduce((a, m) => a + m.monto, 0);
  const efectivoEsperado = session.saldoInicial + ventasBoletos + ventasEncomiendas + movIngresos - movEgresos;
  return { ventasBoletos, ventasEncomiendas, movIngresos, movEgresos, efectivoEsperado };
}

router.get('/session/current', async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.user!.sub);
  const session = await db.cashSession.findFirst({
    where: { userId, tenantId: req.tenant!.id, estado: 'Abierta' },
    include: {
      branch: { select: { id: true, nombre: true, ciudad: true } },
      movements: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!session) { res.json(null); return; }
  const resumen = await buildResumen(session);
  res.json({ ...session, resumen });
});

router.get('/sessions', requireRole('admin', 'supervisor'), async (req: Request, res: Response): Promise<void> => {
  const { branchId, estado } = req.query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { tenantId: req.tenant!.id };
  if (branchId) where['branchId'] = parseInt(branchId as string);
  if (estado) where['estado'] = estado;

  const sessions = await db.cashSession.findMany({
    where,
    include: {
      user: { select: { id: true, nombre: true, email: true } },
      branch: { select: { id: true, nombre: true, ciudad: true } },
      _count: { select: { movements: true } },
    },
    orderBy: { abiertaAt: 'desc' },
    take: 100,
  });
  res.json(sessions);
});

router.get('/session/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const userId = parseInt(req.user!.sub);
  const userRol = req.user!.rol;

  const session = await db.cashSession.findFirst({
    where: { id, tenantId: req.tenant!.id },
    include: {
      user: { select: { id: true, nombre: true } },
      branch: { select: { id: true, nombre: true, ciudad: true } },
      movements: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!session) { res.status(404).json({ message: 'Sesión no encontrada' }); return; }
  if (session.userId !== userId && !['admin', 'supervisor'].includes(userRol)) {
    res.status(403).json({ message: 'Acceso denegado' }); return;
  }

  const resumen = await buildResumen(session);
  res.json({ ...session, resumen });
});

router.post('/session', requireRole('admin', 'supervisor', 'boletero'), async (req: Request, res: Response): Promise<void> => {
  const { branchId, saldoInicial } = z.object({
    branchId: z.number().int().positive(),
    saldoInicial: z.number().min(0),
  }).parse(req.body);

  const userId = parseInt(req.user!.sub);

  const existing = await db.cashSession.findFirst({
    where: { userId, tenantId: req.tenant!.id, estado: 'Abierta' },
  });
  if (existing) { res.status(400).json({ message: 'Ya tienes una sesión de caja abierta', sessionId: existing.id }); return; }

  const branch = await db.branch.findFirst({ where: { id: branchId, tenantId: req.tenant!.id, activo: true } });
  if (!branch) { res.status(400).json({ message: 'Sucursal no encontrada o inactiva' }); return; }

  const session = await db.cashSession.create({
    data: { userId, branchId, saldoInicial, tenantId: req.tenant!.id },
    include: { branch: { select: { id: true, nombre: true, ciudad: true } } },
  });
  res.status(201).json(session);
});

router.post('/session/:id/close', requireRole('admin', 'supervisor', 'boletero'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { saldoFinal } = z.object({ saldoFinal: z.number().min(0) }).parse(req.body);
  const userId = parseInt(req.user!.sub);
  const userRol = req.user!.rol;

  const session = await db.cashSession.findFirst({ where: { id, tenantId: req.tenant!.id } });
  if (!session) { res.status(404).json({ message: 'Sesión no encontrada' }); return; }
  if (session.estado === 'Cerrada') { res.status(400).json({ message: 'La sesión ya está cerrada' }); return; }
  if (session.userId !== userId && !['admin', 'supervisor'].includes(userRol)) {
    res.status(403).json({ message: 'Solo puedes cerrar tu propia sesión' }); return;
  }

  const cerradaAt = new Date();
  const resumen = await buildResumen({ ...session, cerradaAt });
  const diferencia = saldoFinal - resumen.efectivoEsperado;

  const updated = await db.cashSession.update({
    where: { id },
    data: { saldoFinal, diferencia, cerradaAt, estado: 'Cerrada' },
  });
  res.json({ ...updated, resumen });
});

router.post('/session/:id/movements', requireRole('admin', 'supervisor', 'boletero'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { tipo, monto, concepto } = z.object({
    tipo: z.enum(['Ingreso', 'Egreso']),
    monto: z.number().positive(),
    concepto: z.string().min(1).max(255),
  }).parse(req.body);

  const userId = parseInt(req.user!.sub);
  const userRol = req.user!.rol;

  const session = await db.cashSession.findFirst({ where: { id, tenantId: req.tenant!.id } });
  if (!session) { res.status(404).json({ message: 'Sesión no encontrada' }); return; }
  if (session.estado === 'Cerrada') { res.status(400).json({ message: 'La sesión ya está cerrada' }); return; }
  if (session.userId !== userId && !['admin', 'supervisor'].includes(userRol)) {
    res.status(403).json({ message: 'No puedes agregar movimientos a la sesión de otro usuario' }); return;
  }

  const movement = await db.cashMovement.create({
    data: { sessionId: id, tipo, origen: 'Manual', monto, concepto, tenantId: req.tenant!.id },
  });
  res.status(201).json(movement);
});

export default router;
