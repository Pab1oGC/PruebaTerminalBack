import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/stats', (req: Request, res: Response): void => {
  // TODO: reemplazar con datos reales de la base de datos
  res.json({
    usuario: req.user,
    stats: {
      viajesHoy: 0,
      boletosVendidos: 0,
      encomiendasPendientes: 0,
      flotas: 0,
    },
  });
});

export default router;
