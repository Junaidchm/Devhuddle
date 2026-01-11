
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
  target: app_config.chatServiceUrl || "http://chat-service:4004", // Fallback if env missing
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  
  onProxyReq: (proxyReq, req, res) => {
    logger.info(
      `[Chat Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.chatServiceUrl}`
    );
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
