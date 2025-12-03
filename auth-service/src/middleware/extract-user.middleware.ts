import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.util";
import { CustomError } from "../utils/error.util";
import { HttpStatus } from "../constents/httpStatus";
import { Messages } from "../constents/reqresMessages";
import { jwtPayload } from "../types/auth";

/**
 * Middleware to extract user data from x-user-data header
 * This is used when requests come from API Gateway which forwards
 * authenticated user data via the x-user-data header
 * 
 * Sets req.user with the decoded user data from the header
 */
export default function extractUserMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check if user data is already set (from cookies/jwt middleware)
    if (req.user) {
      return next();
    }

    // Extract user data from x-user-data header (set by API Gateway)
    const userDataHeader = req.headers["x-user-data"] as string;
    
    if (!userDataHeader) {
      logger.error("No x-user-data header found");
      throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_NOT_FOUND);
    }

    // Parse the user data from the header
    let userData;
    try {
      userData = JSON.parse(userDataHeader);
    } catch (parseError) {
      logger.error("Failed to parse x-user-data header", { error: parseError });
      throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_INVALID);
    }

    // Validate that user data has required fields
    if (!userData.id || !userData.role) {
      logger.error("Invalid user data in x-user-data header", { userData });
      throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_INVALID);
    }

    // Set req.user for use by role middleware and controllers
    // Type assertion: userData from header matches jwtPayload structure
    req.user = userData as jwtPayload;
    
    logger.info(`[ExtractUser] User extracted from header: ${userData.id}, role: ${userData.role}`);
    
    next();
  } catch (err: any) {
    logger.error("Extract user middleware error", { error: err.message });
    if (err instanceof CustomError) {
      throw err;
    }
    throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_INVALID);
  }
}

