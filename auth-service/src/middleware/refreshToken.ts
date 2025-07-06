import { NextFunction, Request, Response } from "express";
import { HttpStatus } from "../constents/httpStatus";
import { Messages } from "../constents/reqresMessages";
import jwt from "jsonwebtoken";
import { CustomError, sendErrorResponse } from "../utils/error.util";
import { jwtPayload } from "../types/auth";
import logger from "../utils/logger.util";
import { verifyRefreshToken } from "../utils/jwt.util";

export default async function refreshTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies.refresh_token;
    if (!token) {
      logger.error("No JWT token provided");
      throw new CustomError(403, "No token provided");
    }

    // decode refresh token
    const decoded = await verifyRefreshToken(token);
    if (!decoded) {
      throw new CustomError(403, Messages.TOKEN_INVALID);
    }
    req.user = decoded;
    next();
  } catch (err: any) {
    logger.error("refresh token verification failed", { error: err.message });
    sendErrorResponse(
      res,
      err instanceof CustomError
        ? err
        : { status: 403, message: Messages.TOKEN_INVALID }
    );
  }
}
