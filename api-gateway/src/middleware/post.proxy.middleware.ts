import { app_config } from "../config/app.config";
import { createProxyMiddleware, Options } from "http-proxy-middleware";
import { logger } from "../utils/logger";
import { Request, Response } from "express";

/**
 * Proxy for Post Service (Feed Operations)
 * Handles all routes that should be forwarded to the Post Service:
 * - /feed/* -> /api/v1/posts/* (after mapping)
 */
export const postServiceProxy = createProxyMiddleware({
  target: process.env.POST_SERVICE_URL!,
  changeOrigin: true,
  // Map /feed routes to /api/v1/posts routes
  pathRewrite: {
    "^/feed/submit": "/api/v1/posts/submit",
    "^/feed/list": "/api/v1/posts/list",
    "^/feed/media": "/api/v1/posts/media",
    "^/feed/medias": "/api/v1/posts/medias/unused",
    "^/feed/delete": "/api/v1/posts/delete",
  },
  onProxyReq: (proxyReq, req: any, res: Response) => {
    // Forward user data from JWT middleware if available
    if (req.user) {
      proxyReq.setHeader("x-user-data", JSON.stringify(req.user));
      logger.info(`[Post Proxy] User authenticated: ${req.user.id}`);
    } else {
      logger.warn(`[Post Proxy] No user data found in request for ${req.originalUrl}`);
    }
    
    // CRITICAL: Handle request body for POST/PUT/PATCH requests
    // When Express.json() parses the body, it consumes the request stream
    // http-proxy-middleware will try to pipe the consumed stream (which is empty)
    // We MUST manually write the parsed body to the proxy request
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      const bodyData = JSON.stringify(req.body);
      const bodyLength = Buffer.byteLength(bodyData);
      
      // CRITICAL: Remove any existing content-length header
      // We'll set our own based on the serialized body
      proxyReq.removeHeader("content-length");
      
      // Set headers for the new body
      proxyReq.setHeader("content-type", "application/json");
      proxyReq.setHeader("content-length", bodyLength.toString());
      
      // CRITICAL: Prevent http-proxy-middleware from piping the consumed stream
      // Pause the original stream to prevent proxy from piping it
      if (req.readable && !req.readableEnded) {
        req.pause();
      }
      
      // Write the parsed body manually
      // This is REQUIRED because Express already consumed the original stream
      proxyReq.write(bodyData);
      
      // CRITICAL: End the proxy request after writing to prevent proxy from piping empty stream
      // This ensures http-proxy-middleware doesn't try to pipe the consumed original stream
      proxyReq.end();
      
      logger.info(`[Post Proxy] Writing body to proxy request`, {
        bodyLength: bodyLength,
        bodyKeys: Object.keys(req.body),
        bodyPreview: bodyData.substring(0, 200),
      });
    }
    
    // Special handling for DELETE /feed/delete - extract postId from body and add to path
    // FIX: Do not manually set proxyReq.path here as it conflicts with createProxyMiddleware's pathRewrite
    // The pathRewrite mapping "^/feed/delete": "/api/v1/posts/delete" should handle it
    // if req.url is /feed/delete
    if (req.method === "DELETE" && req.url === "/feed/delete") {
         // just ensure the body is passed correctly (handled above)
    }
    
    logger.info(
      `[Post Proxy] Forwarding ${req.method} ${req.originalUrl} to ${process.env.POST_SERVICE_URL}${proxyReq.path}`,
      {
        target: process.env.POST_SERVICE_URL,
        targetPath: proxyReq.path,
        originalPath: req.path,
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
      }
    );
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log response for debugging
    logger.info(`[Post Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
    
    if (proxyRes.headers["content-type"]?.includes("image")) {
      proxyRes.headers["access-control-allow-origin"] =
        process.env.frontend_URL || "http://localhost:3000";
      proxyRes.headers["access-control-allow-methods"] = "GET";
      proxyRes.headers["access-control-allow-headers"] = "Content-Type";
      proxyRes.headers["access-control-allow-credentials"] = "true";
    }
  },
  onError: (err, req, res) => {
    logger.error("Post Service Proxy error:", { error: err.message });
    if (typeof res.status === "function") {
      res.status(500).json({ error: "Proxy failed" });
    } else {
      res.end("Proxy failed");
    }
  },
});

