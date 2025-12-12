import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.util";

export const extractUserFromHeader = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userData = req.headers["x-user-data"];

    if (userData) {
      if (typeof userData === "string") {
        try {
          (req as any).user = JSON.parse(userData);
        } catch (e) {
          logger.error("Failed to parse user data from header", { userData });
        }
      } else if (Array.isArray(userData)) {
         // Should not happen, but handle it
         try {
           (req as any).user = JSON.parse(userData[0]);
         } catch (e) {
            logger.error("Failed to parse user data from header array", { userData });
         }
      }
    }
    
    // Log for debugging
    if ((req as any).user) {
        // logger.info("User extracted from header", { userId: (req as any).user.id });
    }

    next();
  } catch (error) {
    logger.error("Error in extractUserFromHeader middleware", { error });
    next();
  }
};
