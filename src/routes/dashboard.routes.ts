import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const tid = req.tenant!.id;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const [boletosHoy, ingresoHoy, habilitacionesActivas, encomiendasPendientes, flotaActiva] = await Promise.all([
    db.ticket.count({ where: { tenantId: tid, vendidoAt: { gte: hoy } } }),
    db.ticket.aggregate({ where: { tenantId: tid, vendidoAt: { gte: hoy } }, _sum: { precio: true } }),
    db.schedule.count({ where: { tenantId: tid, estado: { in: ['Habilitada', 'EnCurso'] } } }),
    db.parcel.count({ where: { tenantId: tid, estado: { not: 'Entregada' } } }),
    db.bus.count({ where: { tenantId: tid, activo: true } }),
  ]);

  res.json({
    usuario: req.user,
    tenant: { id: req.tenant!.id, nombre: req.tenant!.nombre },
    stats: {
      boletosHoy,
      ingresosHoy: ingresoHoy._sum.precio ?? 0,
      habilitacionesActivas,
      encomiendasPendientes,
      flotaActiva,
    },
  });
});

export default router;
