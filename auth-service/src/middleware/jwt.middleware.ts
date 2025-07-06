import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.util";
import { CustomError, sendErrorResponse } from "../utils/error.util";
import { HttpStatus } from "../constents/httpStatus";
import { Messages } from "../constents/reqresMessages";
import { verifyAccessToken } from "../utils/jwt.util";
import { checkUserBlockBlackList } from "../utils/redis.actions";
import { clearCookies } from "../utils/jwtHandler";

export default async function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies.access_token;
  if (!token) {
    logger.error("No JWT token provided");
    throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_NOT_FOUND);
  }

  try {
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

    next();
  } catch (err: any) {
    logger.error("JWT verification error", { error: err.message });
    sendErrorResponse(
      res,
      err instanceof CustomError
        ? err
        : { status: HttpStatus.UNAUTHORIZED, message: Messages.TOKEN_INVALID }
    );
  }
}
