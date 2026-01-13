// Type definitions for Express Request with user data from API Gateway

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
        [key: string]: unknown;
      };
    }
  }
}

export {};
