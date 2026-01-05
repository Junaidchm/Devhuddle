import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "../utils/logger";
import { Request, Response, NextFunction } from "express";

/**
 * Unified Proxy for Project Service
 * Handles all routes that should be forwarded to the Project Service:
 * - /api/v1/projects/* -> /api/v1/projects/* (forward as-is to project-service)
 * 
 * Pattern: Forward all /api/v1/projects/* requests to project-service HTTP endpoint
 */

// Validate that PROJECT_SERVICE_URL is set
if (!app_config.projectServiceUrl) {
  logger.warn(
    "[Project Proxy] PROJECT_SERVICE_URL is not set. Project service proxy will not be available."
  );
}

// Fallback middleware that returns 503 if service is not configured
const fallbackMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.warn(
    `[Project Proxy] Request to ${req.url} but PROJECT_SERVICE_URL is not configured`
  );
  res.status(503).json({
    error: "Service Unavailable",
    message: "Project service is not configured. Please set PROJECT_SERVICE_URL environment variable.",
  });
};

// Only create proxy if URL is configured, otherwise use fallback
export const projectServiceProxy = app_config.projectServiceUrl
  ? createProxyMiddleware({
      target: app_config.projectServiceUrl,
      changeOrigin: true,
      timeout: 30000, // 30 second timeout
      // Forward path as-is: /api/v1/projects/* -> /api/v1/projects/*
      // No pathRewrite needed since paths match exactly
      onProxyReq: (proxyReq, req: any, res) => {
        // Forward user data from JWT middleware if available
        if (req.user) {
          proxyReq.setHeader("x-user-data", JSON.stringify(req.user));
          logger.info(`[Project Proxy] User authenticated: ${req.user.id}`);
        } else if (req.headers["x-user-data"]) {
          // Forward existing x-user-data header if present
          proxyReq.setHeader("x-user-data", req.headers["x-user-data"]);
        }
        
        // CRITICAL: Handle request body for POST/PUT/PATCH requests
        // When Express.json() parses the body, it consumes the request stream
        // http-proxy-middleware will try to pipe the consumed stream (which is empty)
        // We MUST manually write the parsed body to the proxy request
        if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE" && req.body) {
          try {
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
            
            logger.info(`[Project Proxy] Writing body to proxy request`, {
              bodyLength: bodyLength,
              bodyKeys: Object.keys(req.body),
              url: req.originalUrl,
            });
          } catch (bodyError: unknown) {
            logger.error("[Project Proxy] Error writing body to proxy request", {
              error: (bodyError as Error).message,
              url: req.originalUrl,
            });
            // Don't throw - let the proxy continue, but log the error
          }
        }
        
        logger.info(
          `[Project Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.projectServiceUrl}${req.url}`,
          {
            target: app_config.projectServiceUrl,
            targetPath: req.url,
            originalPath: req.path,
            hasBody: !!req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
          }
        );
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log successful proxy responses
        if (req.url?.includes("/projects")) {
          logger.debug(
            `[Project Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`
          );
        }
      },
      onError: (err: unknown, req, res) => {
        const error = err as any;
        logger.error("[Project Proxy] Proxy error", {
          error: error.message,
          url: req.url,
          method: req.method,
          code: error.code,
          stack: error.stack,
        });
        
        // Handle different error types
        const errorCode = error.code || error.errno;
        if (errorCode === "ECONNREFUSED") {
          if (typeof res.status === "function") {
            res.status(503).json({
              error: "Service Unavailable",
              message: "Unable to connect to project service",
            });
          } else {
            res.end("Service Unavailable");
          }
        } else if (errorCode === "ETIMEDOUT" || errorCode === "ECONNRESET") {
          if (typeof res.status === "function") {
            res.status(504).json({
              error: "Gateway Timeout",
              message: "Project service request timed out",
            });
          } else {
            res.end("Gateway Timeout");
          }
        } else {
          if (typeof res.status === "function") {
            res.status(500).json({
              error: "Proxy failed",
              message: "Unable to connect to project service",
            });
          } else {
            res.end("Proxy failed");
          }
        }
      },
    })
  : fallbackMiddleware;

