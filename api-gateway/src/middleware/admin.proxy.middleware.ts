import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";
import { Request, Response, NextFunction } from "express";

/**
 * Admin Service Proxy
 * 
 * Proxies admin routes to Auth Service (Centralized Admin Hub):
 * - /api/v1/admin/reports -> /api/v1/admin/reports
 * - /api/v1/admin/users -> /api/v1/admin/users
 * - /api/v1/admin/audit-logs -> /api/v1/admin/audit-logs
 * 
 * Pattern: Forwards directly to auth-service (no path rewrite needed)
 */

// Validate that AUTH_SERVICE_URL is set
if (!app_config.authServiceUrl) {
  logger.warn(
    "[Admin Proxy] AUTH_SERVICE_URL is not set. Admin service proxy will not be available."
  );
}

// Fallback middleware that returns 503 if service is not configured
const fallbackMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.warn(
    `[Admin Proxy] Request to ${req.url} but AUTH_SERVICE_URL is not configured`
  );
  res.status(503).json({
    error: "Service Unavailable",
    message: "Admin service is not configured. Please set AUTH_SERVICE_URL environment variable.",
  });
};

// Only create proxy if at least auth service is configured
export const adminServiceProxy = app_config.authServiceUrl
  ? createProxyMiddleware(
      (path) => path.startsWith("/api/v1/admin") || path.startsWith("/admin"),
      {
        router: (req) => {
          const path = req.url || "";
          const originalPath = (req as any).originalUrl || path;
          
          logger.info(`[Admin Proxy Router] deciding target for: ${path} (original: ${originalPath})`);

          if (path.includes("/admin/posts") || originalPath.includes("/admin/posts") ||
              path.includes("/admin/comments") || originalPath.includes("/admin/comments") ||
              path.includes("/admin/reports") || originalPath.includes("/admin/reports") ||
              path.includes("/admin/analytics") || originalPath.includes("/admin/analytics")) {
            logger.info(`[Admin Proxy] Routing to Post Service: ${path}`);
            return app_config.postServiceUrl;
          }
          
          if (path.includes("/admin/projects") || originalPath.includes("/admin/projects")) {
            logger.info(`[Admin Proxy] Routing to Project Service: ${path}`);
            return app_config.projectServiceUrl;
          }
          
          if (path.includes("/admin/hubs") || originalPath.includes("/admin/hubs")) {
            logger.info(`[Admin Proxy] Routing to Chat Service: ${path}`);
            return app_config.chatServiceUrl;
          }
          
          // Default to Auth Service for users, user details, audit-logs, etc.
          logger.info(`[Admin Proxy] Routing to Auth Service (Default): ${path}`);
          return app_config.authServiceUrl;
        },
        changeOrigin: true,
        // No path rewrite - forward /api/v1/admin/... as is
      onProxyReq: (proxyReq, req: any, res) => {
        const targetHost = (proxyReq as any).host;
        const targetProtocol = (proxyReq as any).protocol;
        const targetUrl = `${targetProtocol}//${targetHost}${proxyReq.path}`;
        
        logger.info(
          `[Admin Proxy] Forwarding ${req.method} ${req.originalUrl} -> ${targetUrl}`
        );

        // Forward user data from JWT middleware if available
        const userData = req.user || (req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string) : null);
        
        if (userData) {
          proxyReq.setHeader("x-user-data", JSON.stringify(userData));
        }

        // CRITICAL: Handle request body for POST/PUT/PATCH requests
        if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
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
        if (typeof (res as any).status === "function") {
          (res as any).status(500).json({ error: "Proxy failed", message: "Unable to connect to admin service" });
        } else {
          res.end("Proxy failed");
        }
      },
    })
  : fallbackMiddleware;

