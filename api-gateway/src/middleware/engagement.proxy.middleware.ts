import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";

/**
 *  Engagement Service Proxy
 * 
 * Proxies all engagement routes to Post Service:
 * - /api/v1/engagement/posts/:postId/likes -> /api/v1/posts/:postId/likes
 * - /api/v1/engagement/comments/:commentId/likes -> /api/v1/comments/:commentId/likes
 * - etc.
 * 
 * Pattern: Removes /engagement prefix and forwards to post-service
 */
export const engagementServiceProxy = createProxyMiddleware({
  target: process.env.POST_SERVICE_URL as string,
  changeOrigin: true,
  // Remove /engagement prefix, keep the rest
  // /api/v1/engagement/posts/:id/likes -> /api/v1/posts/:id/likes
  pathRewrite: { "^/api/v1/engagement": "/api/v1" },
  onProxyReq: (proxyReq, req, res) => {
    logger.info(
      `[Engagement Proxy] Forwarding ${req.method} ${req.originalUrl} to ${process.env.POST_SERVICE_URL || "http://localhost:3002"}`
    );
  },
  onError: (err, req, res) => {
    logger.error("Engagement Service Proxy error:", { error: err.message });
    if (typeof res.status === "function") {
      res.status(500).json({ error: "Proxy failed" });
    } else {
      res.end("Proxy failed");
    }
  },
});