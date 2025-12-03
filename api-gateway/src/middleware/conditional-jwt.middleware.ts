import { Request, Response, NextFunction } from "express";
import jwtMiddleware from "./jwt.middleware";
import { logger } from "../utils/logger";

/**
 * Conditional JWT Middleware
 * Applies JWT validation only to protected routes
 * Skips JWT validation for public routes
 */

// Public routes that don't require JWT
const PUBLIC_ROUTES = [
  // OAuth routes
  '/api/v1/auth/google',
  '/api/v1/auth/google/callback',
  // Authentication routes (public)
  '/api/v1/auth/login',
  '/api/v1/auth/signup',
  '/api/v1/auth/verify-otp',
  '/api/v1/auth/resend',
  '/api/v1/auth/password-reset',
  '/api/v1/auth/password-reset/confirm',
  '/api/v1/auth/refresh', // Refresh token uses refresh token from body, not access token
];

// Routes that work with optional JWT (public but can use auth if available)
// These routes will try to validate JWT if present, but won't fail if missing
// Project routes - GET endpoints are public, but can use auth for personalized content
const OPTIONAL_JWT_ROUTES: string[] = [
  '/api/v1/projects', // List projects
  '/api/v1/projects/trending', // Trending projects
  '/api/v1/projects/top', // Top projects
  '/api/v1/projects/search', // Search projects
];

/**
 * Checks if the current route is a public route
 */
function isPublicRoute(path: string): boolean {
  // Check for exact match or path that starts with the public route (for routes with query params)
  return PUBLIC_ROUTES.some(publicRoute => {
    // Exact match
    if (path === publicRoute) return true;
    // Match routes that start with public route (for routes like /api/v1/auth/google/callback)
    if (path.startsWith(publicRoute + '/')) return true;
    // Match routes with query parameters
    if (path.split('?')[0] === publicRoute) return true;
    return false;
  });
}

/**
 * Checks if the current route works with optional JWT
 */
function isOptionalJwtRoute(path: string): boolean {
  return OPTIONAL_JWT_ROUTES.some(optionalRoute => {
    // Exact match
    if (path === optionalRoute) return true;
    // Match routes that start with optional route (e.g., /api/v1/projects/:id)
    if (path.startsWith(optionalRoute + '/')) return true;
    // Match routes with query parameters
    const pathWithoutQuery = path.split('?')[0];
    if (pathWithoutQuery === optionalRoute) return true;
    if (pathWithoutQuery.startsWith(optionalRoute + '/')) return true;
    return false;
  });
}

/**
 * Conditional JWT Middleware
 * Applies JWT validation only for protected routes
 * Skips JWT validation for public routes
 */
/**
 * Optional JWT middleware - validates JWT if present, but doesn't fail if missing
 */
async function optionalJwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (token) {
      // If token is present, try to validate it
      const { verifyAccessToken } = await import("../utils/jwt.util");
      const { checkUserBlockBlackList } = await import("../utils/redis.actions");
      const decoded = await verifyAccessToken(token);
      
      if (decoded) {
        const isBlackListed = await checkUserBlockBlackList(decoded.id);
        if (!isBlackListed) {
          req.user = decoded;
          req.headers["x-user-data"] = JSON.stringify(decoded);
        }
      }
    }
    // Continue regardless of whether token was present or valid
    next();
  } catch (err) {
    // If validation fails, just continue without user data
    logger.info(`[ConditionalJWT] Optional JWT validation failed, continuing without auth: ${err}`);
    next();
  }
}

export default function conditionalJwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Use originalUrl to get the full path (req.path is relative to the mount point)
  // Remove query string for matching
  const fullPath = req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || req.path;
  
  // Debug logging (can be removed in production)
  const isPublic = isPublicRoute(fullPath);
  if (isPublic) {
    logger.info(`[ConditionalJWT] Public route detected: ${fullPath}, skipping JWT validation`);
    return next();
  }
  
  // Check if route works with optional JWT
  const isOptional = isOptionalJwtRoute(fullPath);
  if (isOptional) {
    logger.info(`[ConditionalJWT] Optional JWT route: ${fullPath}, validating JWT if present`);
    return optionalJwtMiddleware(req, res, next);
  }
  
  // For protected routes, apply JWT validation
  logger.info(`[ConditionalJWT] Protected route: ${fullPath}, applying JWT validation`);
  return jwtMiddleware(req, res, next);
}

