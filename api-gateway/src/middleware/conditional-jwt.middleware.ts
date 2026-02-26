import { Request, Response, NextFunction } from "express";
import jwtMiddleware from "./jwt.middleware";

/**
 * Conditional JWT Middleware
 *
 * Applies strict JWT validation to all routes EXCEPT the explicitly listed public routes.
 *
 * PUBLIC ROUTES: Routes that don't require authentication at all.
 *   - Login, signup, OTP verification, password reset → no token needed
 *   - Token refresh → uses the refresh token from the request (not access token)
 *   - Logout → accepts the request even if access token is expired (we blacklist via refresh token)
 *   - Google OAuth routes → handled by Passport, no JWT needed
 *
 * PROTECTED ROUTES: Everything else.
 *   - JWT middleware verifies the access_token cookie (or Bearer header)
 *   - Rejected requests receive 401 Unauthorized
 *   - On success, req.user and x-user-data header are set for downstream services
 */

const PUBLIC_ROUTES = [
  // Google OAuth (redirects to consent screen, no JWT needed)
  "/api/v1/auth/google",
  "/api/v1/auth/google/callback",

  // Credentials auth
  "/api/v1/auth/login",
  "/api/v1/auth/signup",

  // Email verification
  "/api/v1/auth/verify-otp",
  "/api/v1/auth/resend",

  // Password reset
  "/api/v1/auth/password-reset",
  "/api/v1/auth/password-reset/confirm",

  // Token refresh — must be public so expired access tokens don't block refresh
  "/api/v1/auth/refresh",

  // Logout — must be public so users with expired access tokens can still log out
  // The backend blacklists via the refresh token (which is sent in the cookie)
  "/api/v1/auth/logout",
];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((publicRoute) => {
    // Exact match
    if (path === publicRoute) return true;
    // Sub-path match for routes like /api/v1/auth/google/callback
    if (path.startsWith(publicRoute + "/")) return true;
    // Query string stripping
    if (path.split("?")[0] === publicRoute) return true;
    return false;
  });
}

export default async function conditionalJwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const fullPath = req.originalUrl?.split("?")[0] || req.url?.split("?")[0] || req.path;

  if (isPublicRoute(fullPath)) {
    return next();
  }

  // Everything else requires a valid access token
  await jwtMiddleware(req, res, next);
}
