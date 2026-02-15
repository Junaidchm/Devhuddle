import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";
import { Request, Response, NextFunction } from "express";

/**
 *  Engagement Service Proxy
 * 
 * Proxies all engagement routes to Post Service:
 * - /api/v1/engagement/posts/:postId/likes -> /api/v1/posts/:postId/likes
 * - /api/v1/engagement/comments/:commentId/likes -> /api/v1/comments/:commentId/likes
 * - /api/v1/engagement/posts/:postId/comments/preview -> /api/v1/posts/:postId/comments/preview
 * - etc.
 * 
 * Pattern: Removes /engagement prefix and forwards to post-service
 */

// Validate that POST_SERVICE_URL is set
if (!app_config.postServiceUrl) {
  logger.warn(
    "[Engagement Proxy] POST_SERVICE_URL is not set. Engagement service proxy will not be available."
  );
}

// Fallback middleware that returns 503 if service is not configured
const fallbackMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.warn(
    `[Engagement Proxy] Request to ${req.url} but POST_SERVICE_URL is not configured`
  );
  res.status(503).json({
    error: "Service Unavailable",
    message: "Engagement service is not configured. Please set POST_SERVICE_URL environment variable.",
  });
};

// Only create proxy if URL is configured, otherwise use fallback
export const engagementServiceProxy = app_config.postServiceUrl
  ? createProxyMiddleware({
      target: app_config.postServiceUrl,
      changeOrigin: true,
      // Remove /engagement prefix, keep the rest
      // /api/v1/engagement/posts/:id/likes -> /api/v1/posts/:id/likes
      pathRewrite: { "^/api/v1/engagement": "/api/v1" },
      onProxyReq: (proxyReq, req: any, res) => {
        // Forward user data from JWT middleware if available
        if (req.user) {
          proxyReq.setHeader("x-user-data", JSON.stringify(req.user));
          logger.info(`[Engagement Proxy] User authenticated: ${req.user.id}`);
        }
        
        // CRITICAL: Handle request body for POST/PUT/PATCH requests
        // When Express.json() parses the body, it consumes the request stream
        // http-proxy-middleware will try to pipe the consumed stream (which is empty)
        // We MUST manually write the parsed body to the proxy request
        if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length > 0) {
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
          
          logger.info(`[Engagement Proxy] Writing body to proxy request`, {
            bodyLength: bodyLength,
            bodyKeys: Object.keys(req.body),
            bodyPreview: bodyData.substring(0, 200),
          });
        }
        
        logger.info(
          `[Engagement Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.postServiceUrl}${proxyReq.path}`,
          {
            target: app_config.postServiceUrl,
            targetPath: proxyReq.path,
            originalPath: req.path,
            hasBody: !!req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
          }
        );
      },
      onProxyRes: (proxyRes, req, res) => {
        logger.info(`[Engagement Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },
      onError: (err: unknown, req, res) => {
        logger.error("Engagement Service Proxy error:", { error: (err as Error).message });
        if (typeof res.status === "function") {
          res.status(500).json({ error: "Proxy failed", message: "Unable to connect to engagement service" });
        } else {
          res.end("Proxy failed");
        }
      },
    })
  : fallbackMiddleware;