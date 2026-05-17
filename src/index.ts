import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import authRouter from './routes/auth.routes';
import dashboardRouter from './routes/dashboard.routes';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);

// Sirve el build de React en producción
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(env.port, () => {
  console.log(`Servidor corriendo en http://localhost:${env.port} [${env.nodeEnv}]`);
});
