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
      // Forward path as-is: /api/v1/projects/* -> /api/v1/projects/*
      // No pathRewrite needed since paths match exactly
      onProxyReq: (proxyReq, req, res) => {
        logger.info(
          `[Project Proxy] Forwarding ${req.method} ${req.originalUrl} to ${app_config.projectServiceUrl}${req.url}`
        );
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log successful proxy responses (optional)
        if (req.url?.includes("/projects")) {
          logger.debug(
            `[Project Proxy] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`
          );
        }
      },
      onError: (err, req, res) => {
        logger.error("Project Service Proxy error:", { error: err.message });
        if (typeof res.status === "function") {
          res.status(500).json({ error: "Proxy failed", message: "Unable to connect to project service" });
        } else {
          res.end("Proxy failed");
        }
      },
    })
  : fallbackMiddleware;

