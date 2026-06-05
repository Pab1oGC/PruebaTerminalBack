import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { Prisma } from '@prisma/client';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const sellSchema = z.object({
  scheduleId: z.number().int().positive(),
  asientos: z.array(z.object({
    asientoNumero: z.number().int().positive(),
    pasajeroNombre: z.string().min(1).max(128),
    pasajeroRut: z.string().min(1).max(20),
    precio: z.number().positive(),
  })).min(1).max(10),
});

const reserveSchema = z.object({
  scheduleId: z.number().int().positive(),
  asientoNumero: z.number().int().positive(),
  pasajeroNombre: z.string().min(1).max(128),
  pasajeroRut: z.string().min(1).max(20),
  precio: z.number().positive(),
});

router.get('/schedule/:scheduleId', async (req: Request, res: Response): Promise<void> => {
  const scheduleId = parseInt(req.params.scheduleId as string);
  const tickets = await db.ticket.findMany({
    where: { scheduleId, tenantId: req.tenant!.id },
    orderBy: { asientoNumero: 'asc' },
  });
  res.json(tickets);
});

router.post('/sell', requireRole('admin', 'supervisor', 'boletero'), async (req: Request, res: Response): Promise<void> => {
  const { scheduleId, asientos } = sellSchema.parse(req.body);
  const userId = req.user ? parseInt(req.user.sub) : undefined;

  const schedule = await db.schedule.findFirst({
    where: { id: scheduleId, tenantId: req.tenant!.id },
    include: { route: { select: { precioMaximoAtt: true } } },
  });
  if (!schedule) { res.status(404).json({ message: 'Habilitación no encontrada' }); return; }
  if (schedule.estado === 'Finalizada' || schedule.estado === 'Cancelada') {
    res.status(400).json({ message: 'La habilitación no está disponible para venta' }); return;
  }

  for (const a of asientos) {
    if (a.precio > schedule.route.precioMaximoAtt) {
      res.status(400).json({
        message: `El precio ${a.precio} supera el máximo ATT de ${schedule.route.precioMaximoAtt} para asiento ${a.asientoNumero}`,
      }); return;
    }
  }

  try {
    const created = await db.$transaction(
      asientos.map((a) =>
        db.ticket.create({
          data: {
            scheduleId,
            asientoNumero: a.asientoNumero,
            pasajeroNombre: a.pasajeroNombre,
            pasajeroRut: a.pasajeroRut,
            precio: a.precio,
            estado: 'Vendido',
            vendidoPor: userId,
            tenantId: req.tenant!.id,
          },
        })
      )
    );
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ message: 'Uno o más asientos ya están ocupados' });
    } else {
      throw err;
    }
  }
});

router.post('/reserve', requireRole('admin', 'supervisor', 'boletero'), async (req: Request, res: Response): Promise<void> => {
  const data = reserveSchema.parse(req.body);
  const userId = req.user ? parseInt(req.user.sub) : undefined;

  const schedule = await db.schedule.findFirst({
    where: { id: data.scheduleId, tenantId: req.tenant!.id },
    include: { route: { select: { precioMaximoAtt: true } } },
  });
  if (!schedule) { res.status(404).json({ message: 'Habilitación no encontrada' }); return; }
  if (schedule.estado === 'Finalizada' || schedule.estado === 'Cancelada') {
    res.status(400).json({ message: 'La habilitación no está disponible para reserva' }); return;
  }
  if (data.precio > schedule.route.precioMaximoAtt) {
    res.status(400).json({ message: `El precio supera el máximo ATT de ${schedule.route.precioMaximoAtt}` }); return;
  }

  try {
    const ticket = await db.ticket.create({
      data: {
        scheduleId: data.scheduleId,
        asientoNumero: data.asientoNumero,
        pasajeroNombre: data.pasajeroNombre,
        pasajeroRut: data.pasajeroRut,
        precio: data.precio,
        estado: 'Reservado',
        vendidoPor: userId,
        tenantId: req.tenant!.id,
      },
    });
    res.status(201).json(ticket);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ message: 'El asiento ya está ocupado' });
    } else {
      throw err;
    }
  }
});

router.patch('/:id/cobrar', requireRole('admin', 'supervisor', 'boletero'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const ticket = await db.ticket.findFirst({ where: { id, tenantId: req.tenant!.id } });
  if (!ticket) { res.status(404).json({ message: 'Boleto no encontrado' }); return; }
  if (ticket.estado !== 'Reservado') { res.status(400).json({ message: 'Solo se pueden cobrar reservas' }); return; }
  const updated = await db.ticket.update({ where: { id }, data: { estado: 'Vendido' } });
  res.json(updated);
});

router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const ticket = await db.ticket.findFirst({ where: { id, tenantId: req.tenant!.id } });
  if (!ticket) { res.status(404).json({ message: 'Boleto no encontrado' }); return; }

  const schedule = await db.schedule.findUnique({ where: { id: ticket.scheduleId } });
  if (schedule && (schedule.estado === 'Finalizada' || schedule.estado === 'EnCurso')) {
    res.status(400).json({ message: 'No se puede anular un boleto de una habilitación en curso o finalizada' }); return;
  }

  await db.ticket.delete({ where: { id } });
  res.json({ message: 'Boleto anulado' });
});

export default router;
