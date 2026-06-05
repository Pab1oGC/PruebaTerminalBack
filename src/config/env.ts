import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev_secret_change_in_production',
  platformAdminSecret: process.env.PLATFORM_ADMIN_SECRET ?? 'platform_dev_secret_change_in_production',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
