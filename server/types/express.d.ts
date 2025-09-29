/**
 * Express TypeScript declarations
 */

// Request type imported for global declaration

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: 'admin' | 'staff';
        iat?: number;
        exp?: number;
      };
    }
  }
}

export {};










