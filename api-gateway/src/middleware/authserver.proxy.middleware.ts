import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";

/**
 * Unified proxy for Auth Service
 * Handles all routes that should be forwarded to the Auth Service:
 * - /api/v1/auth/* -> /auth/* (after removing /api/v1 prefix)
 * - /api/v1/users/* -> /users/* (after removing /api/v1 prefix)
 */

// Validate AUTH_SERVICE_URL is set
const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
if (!process.env.AUTH_SERVICE_URL) {
  logger.warn(`[Auth Proxy] AUTH_SERVICE_URL not set, using default: ${authServiceUrl}`);
} else {
  logger.info(`[Auth Proxy] Using AUTH_SERVICE_URL: ${authServiceUrl}`);
}

export const authServiceProxy = createProxyMiddleware({
  target: authServiceUrl,
  changeOrigin: true,
  // Remove /api/v1 prefix, keep the rest (/auth, /users, etc.)
  pathRewrite: { "^/api/v1": "" },
  // Add timeout to prevent hanging
  timeout: 30000, // 30 seconds
  // CRITICAL: Don't let proxy consume the body stream automatically
  // Since Express.json() already parsed it, we'll write it manually
  onProxyReq: (proxyReq, req: any, res) => {
    // Forward user data from JWT middleware if available
    // Check both req.user (set by JWT middleware) and x-user-data header (set by JWT middleware)
    const userData = req.user || (req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string) : null);
    
    if (userData) {
      proxyReq.setHeader("x-user-data", JSON.stringify(userData));
      logger.info(`[Auth Proxy] User authenticated: ${userData.id}, role: ${userData.role}`);
    } else {
      logger.warn(`[Auth Proxy] No user data found for ${req.method} ${req.originalUrl}`);
    }
    
    // Also forward Authorization header if present (for services that might need it)
    if (req.headers["authorization"]) {
      proxyReq.setHeader("authorization", req.headers["authorization"] as string);
    }
    
    // CRITICAL: Handle request body for POST/PUT/PATCH requests
    // When Express.json() parses the body, it consumes the request stream
    // http-proxy-middleware will try to pipe the consumed stream (which is empty)
    // We MUST manually write the parsed body to the proxy request
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE" && req.body) {
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
      
      logger.info(`[Auth Proxy] Writing body to proxy request`, {
        bodyLength: bodyLength,
        bodyKeys: Object.keys(req.body),
        bodyPreview: bodyData.substring(0, 100),
      });
    }
    
    // Log the actual path being forwarded
    const targetPath = proxyReq.path;
    logger.info(`[Auth Proxy] Forwarding ${req.method} ${req.originalUrl}`, {
      target: authServiceUrl,
      targetPath: targetPath,
      originalPath: req.path,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      bodyPreview: req.body ? JSON.stringify(req.body).substring(0, 100) : undefined,
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    const statusCode = proxyRes.statusCode ?? 200; // Default to 200 if undefined
    const isError = statusCode >= 400;
    
    if (isError) {
      logger.warn(`[Auth Proxy] Error response ${statusCode} for ${req.method} ${req.originalUrl}`, {
        statusCode,
        url: req.originalUrl,
      });
    } else {
      logger.info(`[Auth Proxy] Response ${statusCode} for ${req.method} ${req.originalUrl}`);
    }
    
    if (proxyRes.headers["content-type"]?.includes("image")) {
      proxyRes.headers["access-control-allow-origin"] = process.env.frontend_URL || "http://localhost:3000";
      proxyRes.headers["access-control-allow-methods"] = "GET";
      proxyRes.headers["access-control-allow-headers"] = "Content-Type";
      proxyRes.headers["access-control-allow-credentials"] = "true";
    }
    
    // Ensure error responses are properly forwarded with their status codes
    // The proxy middleware will forward the response body as-is, including error messages
  },
  onError: (err, req, res: any) => {
    logger.error("Auth Service Proxy error:", { 
      error: err.message,
      stack: err.stack,
      target: authServiceUrl,
      url: req.originalUrl,
      method: req.method,
      code: (err as any).code,
    });
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Proxy failed",
        message: err.message,
        target: authServiceUrl,
      });
    } else {
      res.end('Proxy failed');
    }
  },
});
