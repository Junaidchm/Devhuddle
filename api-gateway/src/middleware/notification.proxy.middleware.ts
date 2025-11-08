import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";

/**
 * Unified Proxy for Notification Service (with WebSocket support)
 * Handles all routes that should be forwarded to the Notification Service:
 * - /api/v1/notifications/* -> /api/v1/notifications/* (notification service expects /api/v1 prefix)
 */
export const notificationServiceProxy = createProxyMiddleware({
  target: app_config.notificationServiceUrl,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  // Notification service expects /api/v1/notifications, so we keep the full path
  pathRewrite: { "^/api/v1/notifications": "/api/v1/notifications" },
  onProxyReq: (proxyReq, req, res) => {
    logger.info(`[Notification Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.notificationServiceUrl}`);
  },
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    let token = req.headers["authorization"];

    // Fallback to checking the query parameter if the header is not present
    if (!token && req.url) {
      const url = new URL(req.url, `ws://${req.headers.host}`);
      const tokenFromQuery = url.searchParams.get('token');
      if (tokenFromQuery) {
        // The downstream service likely expects the "Bearer " prefix
        token = `Bearer ${tokenFromQuery}`;
      }
    }

    if (token) {
      proxyReq.setHeader("Authorization", token);
    }
  },
  onError: (err, req, res) => {
    logger.error("Notification Service Proxy error:", { error: err.message });
    if (typeof res.status === "function") {
      res.status(500).json({ error: "Proxy failed" });
    } else {
      res.end('Proxy failed');
    }
  },
});