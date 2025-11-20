import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { CustomError, sendErrorResponse } from "../utils/error.util";
import { HttpStatus } from "../utils/constents";
import { Messages } from "../constants/reqresMessages";
import { verifyAccessToken } from "../utils/jwt.util";
import { checkUserBlockBlackList } from "../utils/redis.actions";
import { clearCookies } from "../utils/jwtHandler";
import { jwtPayload } from "../types/auth";

// Extend Express Request interface to include 'user'
declare global {
  namespace Express {
    interface Request {
      user?: jwtPayload;
    }
  }
}

export default async function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers["authorization"];
    
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

   
    if (!token) {
      logger.error("No JWT token provided");
      throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_NOT_FOUND);
    }
    const decoded = await verifyAccessToken(token);
    if (!decoded) {
      throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_INVALID);
    }
    const isBlackListed = await checkUserBlockBlackList(decoded.id);
    if (isBlackListed) {
      clearCookies(res);
      throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.USER_BLOCKED);
    }
    
    req.user = decoded;
    //Forward the user data in custom header
    req.headers["x-user-data"] = JSON.stringify(decoded);

    next();
  } catch (err: any) {
    logger.error(`JWT verification error ................., ${err.status}`, {
      error: err.message,
    });
    sendErrorResponse(
      res,
      err instanceof CustomError
        ? err
        : { status: HttpStatus.UNAUTHORIZED, message: Messages.TOKEN_INVALID }
    );
  }
}
