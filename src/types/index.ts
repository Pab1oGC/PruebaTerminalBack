export interface JwtPayload {
  sub: string;
  username: string;
  nombre: string;
  rol: 'admin' | 'boletero' | 'chofer';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
