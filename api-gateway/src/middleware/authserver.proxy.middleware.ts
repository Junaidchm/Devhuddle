import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";

/**
 * Unified proxy for Auth Service
 * Handles all routes that should be forwarded to the Auth Service:
 * - /api/v1/auth/* -> /auth/* (after removing /api/v1 prefix)
 * - /api/v1/users/* -> /users/* (after removing /api/v1 prefix)
 */
export const authServiceProxy = createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL!,
  changeOrigin: true,
  // Remove /api/v1 prefix, keep the rest (/auth, /users, etc.)
  pathRewrite: { "^/api/v1": "" },
  onProxyReq: (proxyReq, req, res) => {
    logger.info(`[Auth Proxy] Forwarding ${req.method} ${req.originalUrl} to ${process.env.AUTH_SERVICE_URL}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.headers["content-type"]?.includes("image")) {
      proxyRes.headers["access-control-allow-origin"] = process.env.frontend_URL || "http://localhost:3000";
      proxyRes.headers["access-control-allow-methods"] = "GET";
      proxyRes.headers["access-control-allow-headers"] = "Content-Type";
      proxyRes.headers["access-control-allow-credentials"] = "true";
    }
  },
  onError: (err, req, res) => {
    logger.error("Auth Service Proxy error:", { error: err.message });
    if (typeof res.status === "function") {
      res.status(500).json({ error: "Proxy failed" });
    } else {
      res.end('Proxy failed');
    }
  },
});
