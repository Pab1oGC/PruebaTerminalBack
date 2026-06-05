import { Tenant, User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  tenantId: number;
  tenantCode: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'supervisor' | 'boletero' | 'chofer';
  branchId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenant?: Tenant;
      currentUser?: User;
    }
  }
}
