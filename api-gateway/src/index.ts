import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { createServer } from "http";
import { HttpStatus } from "./utils/constents";
import { logger } from "./utils/logger";
import { sendErrorResponse } from "./utils/error.util";
import { ApiError } from "./types/auth";
import cors from "cors";
import { authServiceProxy } from "./middleware/authserver.proxy.middleware";
import { notificationServiceProxy } from "./middleware/notification.proxy.middleware";
import authRouter from "./routes/authservice/auth.routes";
import feedRouter from "./routes/feedService/feed.routes";
import generalRouter from "./routes/generalservice/general.routes";
import { connectRedis } from "./utils/redis.util";
import { app_config } from "./config/app.config";
import conditionalJwtMiddleware from "./middleware/conditional-jwt.middleware";
import { ROUTES } from "./constants/routes";
import { engagementServiceProxy } from "./middleware/engagement.proxy.middleware";

dotenv.config();

// create app
const app = express();
const server = createServer(app);

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

// ============================================
// gRPC Routes (direct Express routers, not proxies)
// ============================================
// These routes handle login, signup, verify-otp, etc. via gRPC
// They are NOT HTTP proxy routes - they call gRPC directly
app.use("/auth", authRouter);
app.use(ROUTES.GENERAL.BASE, generalRouter);
app.use(ROUTES.FEED.BASE, feedRouter);

// ============================================
// HTTP Proxy Routes (forwarded to microservices)
// ============================================

// Unified Auth Service Proxy (handles all HTTP routes to auth service)
// Uses conditional JWT middleware: public routes skip JWT, protected routes require JWT
// Public routes: /api/v1/auth/google, /api/v1/auth/google/callback
// Protected routes: /api/v1/auth/search, /api/v1/users/*, /api/v1/auth/admin/*
app.use(ROUTES.AUTH.BASE, conditionalJwtMiddleware, authServiceProxy);
app.use(ROUTES.USERS.BASE, conditionalJwtMiddleware, authServiceProxy);

// Notification Service Routes (protected, JWT required)
app.use(ROUTES.NOTIFICATIONS.BASE, conditionalJwtMiddleware, notificationServiceProxy);

// Engagement Service Routes (protected, JWT required)
app.use(ROUTES.ENGAGEMENT.BASE, conditionalJwtMiddleware, engagementServiceProxy);


// Health check
app.get(ROUTES.HEALTH, (req: Request, res: Response) => {
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
