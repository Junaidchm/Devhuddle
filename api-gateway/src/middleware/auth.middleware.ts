import { Request, Response, NextFunction } from "express";
import { publicRoutes } from "../utils/public-route";
import { ApiError, User } from "../types/auth";
import { HttpStatus } from "../utils/constents";
import { logger } from "../utils/logger";
import jwt from "jsonwebtoken";
import { sendErrorResponse } from "../utils/error.util";

// Extend Express Request interface to include 'user'
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (publicRoutes.includes(req.url)) {
    next();
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    const error: ApiError = {
      status: HttpStatus.UNAUTHORIZED,
      message: "No token provided",
    };
    return sendErrorResponse(res, error);
  }

  try {
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      logger.error("JWT secret is not defined");
    } else {
      // verify jwt token 
      const decode = jwt.verify(token, secretKey) as User;
      req.user = decode;
      logger.info(`Authenticated use ${decode.id}`);
    }
    next();
  } catch (err) {
    const error: ApiError = {
      status: HttpStatus.UNAUTHORIZED,
      message: "Invalid token",
    };
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ status: 401, message: "Token expired" });
    }
    if (err instanceof Error) {
      logger.error(`Auth error: ${err.message}`);
    }
    return res.status(HttpStatus.UNAUTHORIZED).json(error);
  }
};
