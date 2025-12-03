import { jwtPayload } from "./auth";

/**
 * Extend Express Request to include user property
 * This matches what verifyAccessToken returns (jwtPayload)
 */
declare global {
  namespace Express {
    interface Request {
      user?: jwtPayload;
    }
  }
}

export {};

