import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { createServer } from "http";
import { HttpStatus } from "./utils/constents";
import { logger } from "./utils/logger";
import { sendErrorResponse } from "./utils/error.util";
import { ApiError } from "./types/auth";
import cors from "cors";
import {
  authServiceProxy,
  userServiveProxy,
} from "./middleware/authserver.proxy.middleware";
import authRouter from "./routes/authservice/auth.routes";
import feedRouter from "./routes/feedService/feed.routes";
import generalRouter from "./routes/generalservice/general.routes";
import { connectRedis } from "./utils/redis.util";
import { app_config } from "./config/app.config";
import jwtMiddleware from "./middleware/jwt.middleware";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

// create app
const app = express();
const server = createServer(app);

// Proxy for Notification Service (with WebSocket support)
const notificationProxy = createProxyMiddleware({
  target: app_config.notificationServiceUrl,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  // pathRewrite: { "^/notifications": "" }, // This rewrite is causing the 404s
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    let token = req.headers["authorization"];

    // Fallback to checking the query parameter if the header is not present
    if (!token && req.url) {
      const url = new URL(req.url, `ws://${req.headers.host}`);
      const tokenFromQuery = url.searchParams.get("token");
      if (tokenFromQuery) {
        // The downstream service likely expects the "Bearer " prefix
        token = `Bearer ${tokenFromQuery}`;
      }
    }

    if (token) {
      proxyReq.setHeader("Authorization", token);
    }
  },
});

app.use(
  cors({
    origin: [app_config.frontend_URL!],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate Limiting
// app.use(rateLimiter);

// Log all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// HTTP proxy for Google OAuth routes
app.use("/auth/google", authServiceProxy);
// app.use("/auth/google/callback", authServiceProxy);
app.use("/auth/admin", authServiceProxy);

// http proxy for Follow route
app.use("/users", jwtMiddleware, userServiveProxy);

// WebSocket proxy for notifications
app.use("/notifications", jwtMiddleware, notificationProxy);

// grpc rpc routing
app.use("/general", generalRouter);
app.use("/auth", authRouter);
app.use("/feed", feedRouter);



// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({ status: "API Gateway is running" });
});

// Handle favicon to prevent unhandled requests
app.get("/favicon.ico", (req: Request, res: Response) => {
  res.status(204).end();
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const error: ApiError = {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: err.message || "Internal server error",
  };
  sendErrorResponse(res, error);
});

const startServer = async () => {
  try {
    await connectRedis();
    logger.info("Redis connection established");

    const PORT = app_config.port || 3000;
    server.listen(PORT, () => {
      logger.info(`API Gateway running on port ${PORT}`);
    });
  } catch (err: any) {
    logger.error("Failed to start server", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
};

startServer();
