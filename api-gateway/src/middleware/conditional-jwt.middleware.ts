import { Request, Response, NextFunction } from "express";
import jwtMiddleware from "./jwt.middleware";

/**
 * Conditional JWT Middleware
 * Applies JWT validation only to protected routes
 * Skips JWT validation for public routes
 */

// Public routes that don't require JWT
const PUBLIC_ROUTES = [
  '/api/v1/auth/google',
  '/api/v1/auth/google/callback',
];

/**
 * Checks if the current route is a public route
 */
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(publicRoute => path.startsWith(publicRoute));
}

/**
 * Conditional JWT Middleware
 * Applies JWT validation only for protected routes
 * Skips JWT validation for public routes
 */
export default function conditionalJwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // If it's a public route, skip JWT validation
  if (isPublicRoute(req.path)) {
    return next();
  }
  
  // For protected routes, apply JWT validation
  return jwtMiddleware(req, res, next);
}

