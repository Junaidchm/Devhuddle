
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
  
  onProxyReq: (proxyReq, req: any, res) => {
    logger.info(
      `[Notification Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.notificationServiceUrl}`
    );

    // Forward user data from JWT middleware if available
    const userData = req.user || (req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string) : null);
    
    if (userData) {
      proxyReq.setHeader("x-user-data", JSON.stringify(userData));
    }
    
    // Forward Authorization header
    if (req.headers["authorization"]) {
      proxyReq.setHeader("authorization", req.headers["authorization"] as string);
    }

    // CRITICAL: Handle request body for POST/PUT/PATCH requests
    // When Express.json() parses the body, it consumes the request stream
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
      
      logger.info(`[Notification Proxy] Writing body to proxy request`, {
        bodyLength: bodyLength,
        bodyKeys: Object.keys(req.body),
      });
    }
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
