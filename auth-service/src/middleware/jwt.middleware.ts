import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.util";
import { CustomError } from "../utils/error.util";
import { jwtAccessToken } from "../types/auth";
import jwt from "jsonwebtoken";

export default function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {

  logger.info('the profile update code is comming ')
  const token = req.cookies.accessToken;
  if (!token) {
    logger.error("No JWT token provided");
    throw new CustomError(401, "No token provided");
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as jwtAccessToken;
    req.user = decoded;
    next();
  } catch (err: any) {
    logger.error("JWT verification error", { error: err.message });
    throw new CustomError(401, "Invalid or expired token");
  }
}
