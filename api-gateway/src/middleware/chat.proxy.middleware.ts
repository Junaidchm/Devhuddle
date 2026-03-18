
import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";

/**
 * Chat Service Proxy with WebSocket Support
 * Handles:
 * - REST API: /api/v1/chat/* -> http://chat-service:4004/api/v1/chat/*
 * - WebSockets: /api/v1/chat -> ws://chat-service:4004/api/v1/chat
 */
const CHAT_TARGET = app_config.chatServiceUrl || "http://chat-service:4004";

export const chatServiceProxy = createProxyMiddleware(
  (path) => path.startsWith("/api/v1/chat"),
  {
    target: CHAT_TARGET,
    changeOrigin: true,
    ws: true,
    pathRewrite: (path, req) => {
      const newPath = req.originalUrl.replace(/^.*\/v1\/chat/, "/chat");
      logger.info(`[Chat Proxy] ${req.method} ${req.originalUrl} -> ${newPath}`);
      return newPath;
    },
  
  onProxyReq: (proxyReq, req: any, res) => {
    // logger.info(
    //   `[Chat Proxy] Forwarding ${req.method} ${req.originalUrl} to ${CHAT_TARGET}`
    // );

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
      
      // logger.info(`[Chat Proxy] Writing body to proxy request`, {
      //   bodyLength: bodyLength,
      //   bodyKeys: Object.keys(req.body),
      // });
    }
  },

  // WebSocket handling is done manually in index.ts to support async auth


  onProxyRes: (proxyRes, req, res) => {
    // logger.info(`[Chat Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
    // CORS is handled by global middleware in index.ts
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
