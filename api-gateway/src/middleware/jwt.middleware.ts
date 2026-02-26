import { Request, Response, NextFunction } from "express";
import { IncomingMessage } from "http";
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

/**
 * Core authentication logic for both HTTP and WebSockets.
 * Returns the decoded payload if valid, otherwise throws a CustomError.
 */
export async function authenticate(
  req: Request | IncomingMessage,
  res?: Response
): Promise<jwtPayload> {
  const isExpressReq = 'cookies' in req;
  const cookies = isExpressReq ? (req as Request).cookies : parseCookies(req.headers.cookie || "");
  const authHeader = req.headers["authorization"];
  const hasAnyCookies = !!req.headers.cookie;
  
  // 1. Try extracting from access_token cookie
  let token = cookies["access_token"] || null;

  // 2. Fallback to Authorization: Bearer <token> header
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // 3. Fallback to query parameter (common for WebSockets)
  if (!token && 'url' in req && req.url) {
    try {
      // Use a dummy base for relative URLs
      const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      token = urlObj.searchParams.get("token") || urlObj.searchParams.get("accessToken");
    } catch (e) {
      // Ignore URL parse errors
    }
  }

  if (!token) {
    const errorMsg = hasAnyCookies 
      ? "Session expired or access token missing. Please log in again." 
      : Messages.TOKEN_NOT_FOUND;
    throw new CustomError(HttpStatus.UNAUTHORIZED, errorMsg);
  }

  const decoded = await verifyAccessToken(token);
  if (!decoded) {
    if (res) clearCookies(res);
    throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.TOKEN_INVALID);
  }

  const isBlackListed = await checkUserBlockBlackList(decoded.id);
  if (isBlackListed) {
    if (res) clearCookies(res);
    throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.USER_BLOCKED);
  }

  return decoded;
}

/**
 * Simple cookie parser for IncomingMessage (WebSocket)
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length === 2) {
      cookies[parts[0].trim()] = parts[1].trim();
    }
  });
  return cookies;
}

export default async function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const decoded = await authenticate(req, res);
    
    req.user = decoded;
    // Forward the user data in custom header
    req.headers["x-user-data"] = JSON.stringify(decoded);

    next();
  } catch (err: any) {
    // Downgrade 401s to warn level to avoid log floods for expected behavior
    logger.warn(`JWT verification error: ${err.message}`, {
      status: err.status || HttpStatus.UNAUTHORIZED,
      path: req.originalUrl
    });
    
    // Ensure user data is cleared on error
    delete req.user;
    delete req.headers["x-user-data"];

    sendErrorResponse(
      res,
      err instanceof CustomError
        ? err
        : { status: HttpStatus.UNAUTHORIZED, message: Messages.TOKEN_INVALID }
    );
  }
}
