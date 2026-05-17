import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// TODO: reemplazar con consulta a base de datos MySQL cuando esté configurada
const TEMP_USERS = [
  { id: 1, username: 'admin', password: 'admin123', nombre: 'Administrador General', rol: 'admin' as const },
  { id: 2, username: 'boletero1', password: '123456', nombre: 'Juan Pérez', rol: 'boletero' as const },
];

router.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    return;
  }

  const user = TEMP_USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    res.status(401).json({ message: 'Credenciales incorrectas' });
    return;
  }

  const token = jwt.sign(
    { sub: String(user.id), username: user.username, nombre: user.nombre, rol: user.rol },
    env.jwtSecret,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol },
  });
});

router.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.json({ user: req.user });
});

export default router;
