
import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";

/**
 * Chat Service Proxy with WebSocket Support
 * Handles:
 * - REST API: /api/v1/chat/* -> http://chat-service:4004/api/v1/chat/*
 * - WebSockets: /api/v1/chat -> ws://chat-service:4004/api/v1/chat
 */
export const chatServiceProxy = createProxyMiddleware({
  target: app_config.chatServiceUrl || "http://chat-service:4004",
  changeOrigin: true,
  ws: true,
  
  onProxyReq: (proxyReq, req: any, res) => {
    logger.info(
      `[Chat Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.chatServiceUrl}`
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
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE" && req.body) {
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
      
      logger.info(`[Chat Proxy] Writing body to proxy request`, {
        bodyLength: bodyLength,
        bodyKeys: Object.keys(req.body),
      });
    }
  },

  // WebSocket specific handling
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    logger.debug("[Chat Proxy] WebSocket upgrade request", {
      url: req.url,
    });

    // LOGIC: Token Transformation (Query Param -> Header)
    // WebSockets often send token in query param: ws://url?token=xyz
    // We move it to 'Authorization' header so the service stays clean.
    if (req.url) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (token) {
        // Inject Authorization header for the backend service
        proxyReq.setHeader("Authorization", `Bearer ${token}`);
        logger.debug("[Chat Proxy] Injected Authorization header from query param");
      }
    }
  },

  onProxyRes: (proxyRes, req, res) => {
    // Log response for debugging
    logger.info(`[Chat Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
    
    // Explicitly set CORS headers for all responses to avoid network errors
    proxyRes.headers["access-control-allow-origin"] = process.env.frontend_URL || "http://localhost:3000";
    proxyRes.headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    proxyRes.headers["access-control-allow-headers"] = "Content-Type, Authorization, x-user-data";
    proxyRes.headers["access-control-allow-credentials"] = "true";
  },

  onError: (err, req, res) => {
    logger.error("[Chat Proxy] Proxy error", {
      error: err.message,
      url: req.url,
    });

    // Handle WebSocket errors
    if (res && typeof res.end === "function" && typeof res.status !== "function") {
      res.end();
      return;
    }

    // Handle HTTP errors
    if (typeof res.status === "function") {
      res.status(502).json({
        error: "Bad Gateway",
        message: "Unable to connect to chat service",
      });
    } else {
      res.end("Proxy failed");
    }
  },
});
