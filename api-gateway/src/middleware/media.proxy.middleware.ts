import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";
import { Request, Response } from "express";

/**
 * Proxy for Media Service
 * Handles all routes that should be forwarded to the Media Service:
 * - /api/v1/media/* -> Media Service
 */
export const mediaServiceProxy = createProxyMiddleware({
  target: process.env.MEDIA_SERVICE_URL!,
  changeOrigin: true,
  pathRewrite: {
    "^/api/v1/media": "/api/v1/media", // Keep the same path
  },
  onProxyReq: (proxyReq, req: any, res: Response) => {
    // Forward user data from JWT middleware if available
    if (req.user) {
      proxyReq.setHeader("x-user-data", JSON.stringify(req.user));
      logger.info(`[Media Proxy] User authenticated: ${req.user.id}`);
    } else {
      logger.warn(`[Media Proxy] No user data found in request for ${req.originalUrl}`);
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
      
      logger.info(`[Media Proxy] Writing body to proxy request`, {
        bodyLength: bodyLength,
        bodyKeys: Object.keys(req.body),
      });
    }
    
    logger.info(
      `[Media Proxy] Forwarding ${req.method} ${req.originalUrl} to ${process.env.MEDIA_SERVICE_URL}${proxyReq.path}`,
      {
        target: process.env.MEDIA_SERVICE_URL,
        targetPath: proxyReq.path,
        originalPath: req.path,
        hasBody: !!req.body,
      }
    );
  },
  onProxyRes: (proxyRes, req, res) => {
    logger.info(`[Media Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
    
    // Set CORS headers for media responses
    if (proxyRes.headers["content-type"]?.includes("image") || 
        proxyRes.headers["content-type"]?.includes("video")) {
      proxyRes.headers["access-control-allow-origin"] =
        process.env.frontend_URL || "http://localhost:3000";
      proxyRes.headers["access-control-allow-methods"] = "GET";
      proxyRes.headers["access-control-allow-headers"] = "Content-Type";
      proxyRes.headers["access-control-allow-credentials"] = "true";
    }
  },
  onError: (err, req, res) => {
    logger.error("Media Service Proxy error:", { error: err.message });
    if (typeof res.status === "function") {
      res.status(500).json({ error: "Media service proxy failed" });
    } else {
      res.end("Media service proxy failed");
    }
  },
});

