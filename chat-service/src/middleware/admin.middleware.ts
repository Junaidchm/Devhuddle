import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import logger from "../utils/logger.util";

/**
 * Middleware to check if user is superAdmin
 * Extracts user data from x-user-data header set by API Gateway
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const userDataHeader = req.headers["x-user-data"];

    if (!userDataHeader || typeof userDataHeader !== "string") {
      logger.warn("Admin route accessed without x-user-data header");
      throw new AppError("Unauthorized", 401);
    }

    const userData = JSON.parse(userDataHeader);

    if (!userData.id) {
      throw new AppError("User ID not found", 401);
    }

    if (userData.role !== "superAdmin") {
      logger.warn(`Access denied: User ${userData.id} with role ${userData.role} attempted admin access`);
      throw new AppError("Access denied: Admin privileges required", 403);
    }

    // Attach user to request for use in controllers
    (req as any).user = userData;

    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      return next(error);
    }
    logger.error("Error in requireAdmin middleware", { error: error.message });
    next(new AppError("Authentication error", 500));
  }
};
