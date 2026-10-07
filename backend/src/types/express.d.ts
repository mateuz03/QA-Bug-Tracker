import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      user?: {
        id: number;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
