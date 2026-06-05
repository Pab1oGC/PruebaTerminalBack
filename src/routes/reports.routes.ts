import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { Prisma } from '@prisma/client';

const router = Router({ mergeParams: true });
router.use(requireAuth);
router.use(requireRole('admin', 'supervisor'));

router.get('/resumen', async (req: Request, res: Response): Promise<void> => {
  const tid = req.tenant!.id;
  const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin   = new Date(); hoyFin.setHours(23, 59, 59, 999);

  const [
    boletosHoy, ingresosBoletos, encomiendas, habilitacionesActivas,
    flotaActiva, boletosTotal,
  ] = await Promise.all([
    db.ticket.count({ where: { tenantId: tid, vendidoAt: { gte: hoyInicio, lte: hoyFin } } }),
    db.ticket.aggregate({ where: { tenantId: tid, vendidoAt: { gte: hoyInicio, lte: hoyFin } }, _sum: { precio: true } }),
    db.parcel.count({ where: { tenantId: tid, estado: { not: 'Entregada' } } }),
    db.schedule.count({ where: { tenantId: tid, estado: { in: ['Habilitada', 'EnCurso'] } } }),
    db.bus.count({ where: { tenantId: tid, activo: true } }),
    db.ticket.count({ where: { tenantId: tid } }),
  ]);

  res.json({
    boletosHoy,
    ingresosHoy: ingresosBoletos._sum.precio ?? 0,
    encomiendasPendientes: encomiendas,
    habilitacionesActivas,
    flotaActiva,
    boletosTotal,
  });
});

router.get('/ventas-diarias', async (req: Request, res: Response): Promise<void> => {
  const tid = req.tenant!.id;
  const dias = parseInt((req.query.dias as string) ?? '30', 10);

  const rows = await db.$queryRaw<{ fecha: string; cantidad: number; total: number }[]>`
    SELECT
      DATE(vendidoAt) AS fecha,
      COUNT(*) AS cantidad,
      SUM(precio) AS total
    FROM tickets
    WHERE tenantId = ${tid}
      AND vendidoAt >= DATE_SUB(CURDATE(), INTERVAL ${Prisma.raw(String(dias))} DAY)
    GROUP BY DATE(vendidoAt)
    ORDER BY fecha ASC
  `;
  res.json(rows.map(r => ({ ...r, cantidad: Number(r.cantidad), total: Number(r.total) })));
});

router.get('/rutas-top', async (req: Request, res: Response): Promise<void> => {
  const tid = req.tenant!.id;

  const rows = await db.$queryRaw<{ routeId: number; destino: string; origen: string; totalBoletos: number; totalIngresos: number }[]>`
    SELECT
      r.id AS routeId,
      r.destino,
      b.nombre AS origen,
      COUNT(t.id) AS totalBoletos,
      COALESCE(SUM(t.precio), 0) AS totalIngresos
    FROM routes r
    JOIN branches b ON b.id = r.origenBranchId
    LEFT JOIN schedules s ON s.routeId = r.id
    LEFT JOIN tickets t ON t.scheduleId = s.id
    WHERE r.tenantId = ${tid}
    GROUP BY r.id, r.destino, b.nombre
    ORDER BY totalIngresos DESC
    LIMIT 10
  `;
  res.json(rows.map(r => ({ ...r, totalBoletos: Number(r.totalBoletos), totalIngresos: Number(r.totalIngresos) })));
});

router.get('/ocupacion', async (req: Request, res: Response): Promise<void> => {
  const tid = req.tenant!.id;

  const rows = await db.$queryRaw<{ destino: string; totalViajes: number; totalAsientos: number; totalVendidos: number; pctOcupacion: number }[]>`
    SELECT
      r.destino,
      COUNT(DISTINCT s.id) AS totalViajes,
      SUM(st.capacidadTotal) AS totalAsientos,
      COUNT(t.id) AS totalVendidos,
      ROUND(COUNT(t.id) / NULLIF(SUM(st.capacidadTotal), 0) * 100, 1) AS pctOcupacion
    FROM schedules s
    JOIN routes r ON r.id = s.routeId
    JOIN buses bu ON bu.id = s.busId
    JOIN seat_templates st ON st.id = bu.seatTemplateId
    LEFT JOIN tickets t ON t.scheduleId = s.id AND t.estado = 'Vendido'
    WHERE s.tenantId = ${tid}
      AND s.estado IN ('Finalizada', 'EnCurso')
    GROUP BY r.destino
    ORDER BY pctOcupacion DESC
    LIMIT 10
  `;
  res.json(rows.map(r => ({
    ...r,
    totalViajes: Number(r.totalViajes),
    totalAsientos: Number(r.totalAsientos),
    totalVendidos: Number(r.totalVendidos),
    pctOcupacion: Number(r.pctOcupacion ?? 0),
  })));
});

router.get('/encomiendas-estado', async (req: Request, res: Response): Promise<void> => {
  const tid = req.tenant!.id;
  const [registradas, embarcadas, entregadas] = await Promise.all([
    db.parcel.count({ where: { tenantId: tid, estado: 'Registrada' } }),
    db.parcel.count({ where: { tenantId: tid, estado: 'Embarcada' } }),
    db.parcel.count({ where: { tenantId: tid, estado: 'Entregada' } }),
  ]);
  res.json({ registradas, embarcadas, entregadas });
});

export default router;
