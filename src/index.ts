import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { resolveTenant } from './middleware/tenant.middleware';
import authRouter from './routes/auth.routes';
import dashboardRouter from './routes/dashboard.routes';
import branchesRouter from './routes/branches.routes';
import rutasRouter from './routes/rutas.routes';
import templatesRouter from './routes/templates.routes';
import busesRouter from './routes/buses.routes';
import driversRouter from './routes/drivers.routes';
import helpersRouter from './routes/helpers.routes';
import schedulesRouter from './routes/schedules.routes';
import ticketsRouter from './routes/tickets.routes';
import parcelsRouter from './routes/parcels.routes';
import cashRouter from './routes/cash.routes';
import reportsRouter from './routes/reports.routes';
import adminRouter from './routes/admin.routes';
import { startAutoFinalizeJob } from './jobs/autoFinalize';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: true, legacyHeaders: false }));
app.use(
  '/api/t/:tenantCode/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false })
);

const tenant = resolveTenant;

// Tenant-scoped routes
app.use('/api/t/:tenantCode/auth',      tenant, authRouter);
app.use('/api/t/:tenantCode/dashboard', tenant, dashboardRouter);
app.use('/api/t/:tenantCode/branches',  tenant, branchesRouter);
app.use('/api/t/:tenantCode/rutas',     tenant, rutasRouter);
app.use('/api/t/:tenantCode/templates', tenant, templatesRouter);
app.use('/api/t/:tenantCode/buses',     tenant, busesRouter);
app.use('/api/t/:tenantCode/drivers',   tenant, driversRouter);
app.use('/api/t/:tenantCode/helpers',   tenant, helpersRouter);
app.use('/api/t/:tenantCode/schedules', tenant, schedulesRouter);
app.use('/api/t/:tenantCode/tickets',   tenant, ticketsRouter);
app.use('/api/t/:tenantCode/parcels',   tenant, parcelsRouter);
app.use('/api/t/:tenantCode/cash',      tenant, cashRouter);
app.use('/api/t/:tenantCode/reports',   tenant, reportsRouter);

// Platform admin (no tenant middleware)
app.use('/api/admin', adminRouter);

// Serve React build in production
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

startAutoFinalizeJob();

app.listen(env.port, () => {
  console.log(`Servidor corriendo en http://localhost:${env.port} [${env.nodeEnv}]`);
});
