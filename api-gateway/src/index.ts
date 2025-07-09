import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import { HttpStatus } from "./utils/constents";
import { createProxyMiddleware } from "http-proxy-middleware";
import { publicRoutes } from "./utils/public-route";
import { logger } from "./utils/logger";
import { rateLimiter } from "./middleware/rate-limit.middleware";
import { verifyToken } from "./middleware/auth.middleware";
import { sendErrorResponse } from "./utils/error.util";
import { ApiError } from "./types/auth";
import cors from "cors";
import morgan from "morgan";

dotenv.config();

// create app
const app = express();


app.use( cors({
    origin: [
      process.env.frontend_URL as string,
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }))

// Rate Limiting
app.use(rateLimiter);

// Log all request
// app.use((req: Request, res: Response, next: NextFunction) => {
//   logger.info(`${req.method} ${req.url}`);
//   next();
// });

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({ status: "API Gateway is running" });
});


// Route to Auth Service
const authServiceProxy = createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { "^/auth": "" },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${process.env.AUTH_SERVICE_URL}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Add CORS headers for images
    if (proxyRes.headers["content-type"]?.includes("image")) {
      proxyRes.headers["access-control-allow-origin"] = process.env.frontend_URL || "http://localhost:3000";
      proxyRes.headers["access-control-allow-methods"] = "GET";
      proxyRes.headers["access-control-allow-headers"] = "Content-Type";
      proxyRes.headers["access-control-allow-credentials"] = "true";
    }
  },
  onError: (err, req, res) => {
  console.error("Proxy error:", err.message);
  if (typeof res.status === "function") {
    res.status(500).json({ error: "Proxy failed" });
  } else {
    // fallback for non-Express res
    res.end('Proxy failed');
  }
},
});

// Apply proxy for auth routes
app.use('/auth',authServiceProxy)


// Handle favicon to prevent unhandled requests
app.get("/favicon.ico", (req: Request, res: Response) => {
  res.status(204).end(); // No content, avoids 500
});

// Error handling middleware (with next parameter)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const error: ApiError = {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: err.message || "Internal server error",
  };
  sendErrorResponse(res, error);
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
