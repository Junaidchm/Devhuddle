
import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";
import { verifyAccessToken } from "../utils/jwt.util";

/**
 * Unified Proxy for Notification Service (with WebSocket support)
 * Handles all routes that should be forwarded to the Notification Service:
 * - /api/v1/notifications/* -> /api/v1/notifications/* (notification service expects /api/v1 prefix)
 */
export const notificationServiceProxy = createProxyMiddleware({
  target: app_config.notificationServiceUrl,
  changeOrigin: true,
  ws: false, // Disable auto-upgrade to handle manually
  
  onProxyReq: (proxyReq, req, res) => {
    logger.info(
      `[Notification Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.notificationServiceUrl}`
    );
  },

  // WebSocket handling is done manually in index.ts to support async auth


  onProxyRes: (proxyRes, req, res) => {
    // Log successful proxy responses (optional)
    if (req.url?.includes("/notifications")) {
      logger.debug(
        `[Notification Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`
      );
    }
  },

  onError: (err, req, res) => {
    logger.error("[Notification Proxy] Proxy error", {
      error: err.message,
      url: req.url,
      method: req.method,
      stack: err.stack,
    });

    // Handle WebSocket errors (res might be a socket for WebSocket errors)
    if (
      res &&
      typeof res.end === "function" &&
      typeof res.status !== "function"
    ) {
      // This is a WebSocket error
      res.end();
      return;
    }

    // Handle HTTP errors
    if (typeof res.status === "function") {
      res.status(500).json({
        error: "Proxy failed",
        message: "Unable to connect to notification service",
      });
    } else {
      res.end("Proxy failed");
    }
  },
});
