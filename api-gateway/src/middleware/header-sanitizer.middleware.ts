import { Request, Response, NextFunction } from "express";

/**
 * Middleware to sanitize incoming request headers.
 * Deletes sensitive headers that are intended for internal service-to-service communication.
 * This prevents clients from spoofing their identity by manually setting these headers.
 */
export const headerSanitizer = (req: Request, res: Response, next: NextFunction) => {
  const sensitiveHeaders = [
    "x-user-data",
    "x-user-id",
    "x-user-role",
    "x-user-email"
  ];

  sensitiveHeaders.forEach(header => {
    delete req.headers[header];
  });

  next();
};
