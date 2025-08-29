import { Request, Response, NextFunction } from "express";
import { CustomError } from "../utils/error.util";
import {logger} from "../utils/logger";
import { UserRole } from "../constants/user.role";

export const requireRole = (requiredRole: UserRole ) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as { id: string; role: string };
    if (!user || user.role !== requiredRole) {
      logger.error(
        `Access denied: User role ${user?.role} does not match required role ${requiredRole}`
      );
      throw new CustomError(403, "Access denied: Insufficient permissions");
    }
    next();
  };
};
