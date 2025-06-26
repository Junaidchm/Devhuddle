import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.util";
import { CustomError, sendErrorResponse } from "../utils/error.util";
import { jwtAccessToken } from "../types/auth";
import jwt from "jsonwebtoken";
import { HttpStatus } from "../constents/httpStatus";
import { Messages } from "../constents/reqresMessages";

export default function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies.access_token;
  console.log(token)
  if (!token) {
    logger.error("No JWT token provided");
    throw new CustomError(401, "No token provided");
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!
    ) as jwtAccessToken;
    req.user = decoded;

    // if (!decoded.email || !decoded.id || !decoded.username || !decoded.role) {
    //   console.log('hello this causing the error')
    //   throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_INVALID);
    // }

    next();
  } catch (err: any) {
    logger.error("JWT verification error", { error: err.message });
    sendErrorResponse(
      res,
      err instanceof CustomError
        ? err
        : { status: 401, message: Messages.TOKEN_INVALID }
    );
  }
}
