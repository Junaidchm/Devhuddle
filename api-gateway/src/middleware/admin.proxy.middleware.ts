import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";
import { Request, Response, NextFunction } from "express";

/**
 * Admin Service Proxy
 * 
 * Proxies admin routes to Post Service:
 * - /api/v1/admin/reports -> /api/v1/admin/reports
 * - /api/v1/admin/posts -> /api/v1/admin/posts
 * - /api/v1/admin/comments -> /api/v1/admin/comments
 * - /api/v1/admin/analytics -> /api/v1/admin/analytics
 * 
 * Pattern: Forwards directly to post-service (no path rewrite needed)
 */

// Validate that POST_SERVICE_URL is set
if (!app_config.postServiceUrl) {
  logger.warn(
    "[Admin Proxy] POST_SERVICE_URL is not set. Admin service proxy will not be available."
  );
}

// Fallback middleware that returns 503 if service is not configured
const fallbackMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.warn(
    `[Admin Proxy] Request to ${req.url} but POST_SERVICE_URL is not configured`
  );
  res.status(503).json({
    error: "Service Unavailable",
    message: "Admin service is not configured. Please set POST_SERVICE_URL environment variable.",
  });
};

// Only create proxy if URL is configured, otherwise use fallback
export const adminServiceProxy = app_config.postServiceUrl
  ? createProxyMiddleware({
      target: app_config.postServiceUrl,
      changeOrigin: true,
      // No path rewrite - forward as-is
      // /api/v1/admin/reports -> /api/v1/admin/reports
      onProxyReq: (proxyReq, req: any, res) => {
        logger.info(
          `[Admin Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.postServiceUrl}${req.url}`
        );

        // Forward user data from JWT middleware if available
        const userData = req.user || (req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string) : null);
        
        if (userData) {
          proxyReq.setHeader("x-user-data", JSON.stringify(userData));
        }

        // CRITICAL: Handle request body for POST/PUT/PATCH requests
        if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          const bodyLength = Buffer.byteLength(bodyData);
          
          proxyReq.removeHeader("content-length");
          proxyReq.setHeader("content-type", "application/json");
          proxyReq.setHeader("content-length", bodyLength.toString());
          
          if (req.readable && !req.readableEnded) {
            req.pause();
          }
          
          proxyReq.write(bodyData);
          proxyReq.end();
          
          logger.info(`[Admin Proxy] Writing body to proxy request`, {
            bodyLength: bodyLength,
            bodyKeys: Object.keys(req.body),
          });
        }
      },
      onError: (err, req, res) => {
        logger.error("Admin Service Proxy error:", { error: err.message });
        if (typeof res.status === "function") {
          res.status(500).json({ error: "Proxy failed", message: "Unable to connect to admin service" });
        } else {
          res.end("Proxy failed");
        }
      },
    })
  : fallbackMiddleware;

