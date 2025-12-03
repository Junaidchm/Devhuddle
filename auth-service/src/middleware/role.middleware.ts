import { Request, Response, NextFunction } from "express";
import { CustomError } from "../utils/error.util";
import logger from "../utils/logger.util";

export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as { id: string; role: string } | undefined;
    
    if (!user) {
      logger.error(
        `Access denied: No user found in request. Headers: ${JSON.stringify({
          'x-user-data': req.headers['x-user-data'] ? 'present' : 'missing',
          authorization: req.headers['authorization'] ? 'present' : 'missing'
        })}`
      );
      throw new CustomError(403, "Access denied: User not authenticated");
    }
    
    if (user.role !== requiredRole) {
      logger.error(
        `Access denied: User role "${user.role}" does not match required role "${requiredRole}". User ID: ${user.id}`
      );
      throw new CustomError(403, `Access denied: Required role "${requiredRole}" but user has role "${user.role}"`);
    }
    
    logger.info(`[RequireRole] Access granted: User ${user.id} has role ${user.role}`);
    next();
  };
};
