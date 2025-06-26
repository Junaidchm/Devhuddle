import { NextFunction, Request, Response } from "express";
import { HttpStatus } from "../constents/httpStatus";
import { Messages } from "../constents/reqresMessages";
import jwt from "jsonwebtoken";
import { CustomError, sendErrorResponse } from "../utils/error.util";
import { jwtAccessToken } from "../types/auth";
import logger from "../utils/logger.util";

export default function refreshTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies.refresh_token;
    if (!token) {
      logger.error("No JWT token provided");
      throw new CustomError(HttpStatus.UNAUTHORIZED, "No token provided");
    }
    
    // decode refresh token
    const decoded = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as jwtAccessToken;

    req.user = decoded;

    // if (!decoded.email || !decoded.id || !decoded.username || !decoded.role) {
    //   throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_INVALID);
    // }

    next();
  } catch (err: any) {
    logger.error("refresh token verification failed", { error: err.message });
    sendErrorResponse(
      res,
      err instanceof CustomError
        ? err
        : { status: HttpStatus.UNAUTHORIZED, message: Messages.TOKEN_INVALID }
    );
  }
}
