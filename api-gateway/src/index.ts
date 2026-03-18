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
import { projectServiceProxy } from "./middleware/project.proxy.middleware";
import { postServiceProxy } from "./middleware/post.proxy.middleware";
import { mediaServiceProxy } from "./middleware/media.proxy.middleware";
import { connectRedis } from "./utils/redis.util";
import { app_config } from "./config/app.config";
import conditionalJwtMiddleware from "./middleware/conditional-jwt.middleware";
import { ROUTES, API_VERSION } from "./constants/routes";
import { engagementServiceProxy } from "./middleware/engagement.proxy.middleware";
import { adminServiceProxy } from "./middleware/admin.proxy.middleware";
import { chatServiceProxy } from "./middleware/chat.proxy.middleware";
import { verifyAccessToken } from "./utils/jwt.util";
import { checkUserBlockBlackList } from "./utils/redis.actions";

import cookieParser from "cookie-parser";

dotenv.config();

// create app
const app = express();
app.use(cookieParser());
const server = createServer(app);

// 1. Normalize and Log all requests (at the VERY TOP)
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`>>> GATEWAY_BUILD_V14 <<<`);
  console.log(`GATEWAY_INBOUND: ${req.method} ${req.url}`);
  const originalPath = req.url;
  
  // Aggressive normalization: collapse any doubled /api or /v1
  // Handles /api/api/v1, /api/v1/v1, /api/api/v1/v1, etc.
  if (req.url.includes("/api/api") || req.url.includes("/v1/v1")) {
    req.url = req.url
      .replace(/\/api(\/api)+/g, "/api")
      .replace(/\/v1(\/v1)+/g, "/v1");
      
    // Also sync originalUrl to ensure middlewares see the "pure" path
    (req as any).originalUrl = req.url;
    
    logger.info(`Aggressive path normalization: ${originalPath} -> ${req.url}`);
  }

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// 2. Health check
app.get(["/health", "/api/health", API_VERSION + "/health"], (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({ status: "API Gateway is running" });
});

const allowedOrigins = [
  app_config.frontend_URL,
  app_config.frontend_production_url,
  app_config.FRONTEND_PRODUCTION_URL2,
  "https://dev-huddle-prod.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.some(o => o === origin) || 
                       origin.endsWith(".vercel.app") ||
                       origin.includes("sslip.io") ||
                       origin.includes("localhost");
                       
      if (isAllowed) {
        callback(null, origin); // Echo the origin back explicitly
      } else {
        logger.warn(`Origin ${origin} not allowed by CORS (allowed: ${allowedOrigins.join(', ')})`);
        callback(null, origin); // Still echo to unblock troubleshooting
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "x-user-data", "Cookie"],
  })
);

app.use(express.json({
  limit: '10mb',
  verify: (req: Request, res, buf) => {
    (req as any).rawBody = buf;
  },
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
}));

// ============================================
// HTTP Proxy Routes (forwarded to microservices)
// ============================================

app.use("/", conditionalJwtMiddleware, authServiceProxy);
app.use("/", conditionalJwtMiddleware, postServiceProxy);
app.use("/", conditionalJwtMiddleware, mediaServiceProxy);
app.use("/", conditionalJwtMiddleware, notificationServiceProxy);
app.use("/", conditionalJwtMiddleware, engagementServiceProxy);
app.use("/", conditionalJwtMiddleware, projectServiceProxy);
app.use("/", conditionalJwtMiddleware, adminServiceProxy);
app.use("/", conditionalJwtMiddleware, chatServiceProxy);


// Handle favicon to prevent unhandled requests
app.get("/favicon.ico", (req: Request, res: Response) => {
  res.status(204).end();
});

// WebSocket upgrade handler (Manual handling for Async Auth)
server.on("upgrade", async (req, socket, head) => {
  const urlPath = req.url || "";
  logger.info(`WebSocket upgrade request: ${urlPath}`);

  // 1. Route to correct proxy
  let proxy: any = null;
  if (urlPath.startsWith("/api/v1/chat")) {
    proxy = chatServiceProxy;
  } else if (urlPath.startsWith("/api/v1/notifications")) {
    proxy = notificationServiceProxy;
  } else {
    logger.warn(`Unknown WebSocket path: ${urlPath}`);
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  // 2. Extract Token
  // req.url is relative, construct full URL for parsing
  let token: string | null = null;
  try {
    const urlObj = new URL(urlPath, `http://${req.headers.host || "localhost"}`);
    token = urlObj.searchParams.get("token");
  } catch (e) {
    logger.error("Failed to parse WebSocket URL", { error: e });
  }

  if (!token) {
    logger.warn("WebSocket connection rejected: Missing token");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // 3. Authenticate (Async)
  try {
    const decoded = await verifyAccessToken(token);
    
    if (!decoded || !decoded.id) {
      throw new Error("Invalid token or signature");
    }

    // 3b. Check if user is blocked
    const isBlocked = await checkUserBlockBlackList(decoded.id);
    if (isBlocked) {
      logger.warn(`WebSocket connection rejected: user ${decoded.id} is blocked`);
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    // 4. Inject Identity Headers
    // Modify the request headers before passing to proxy
    req.headers["x-user-id"] = decoded.id;
    req.headers["x-user-data"] = JSON.stringify(decoded);

    // 5. Upgrade
    proxy.upgrade(req, socket, head);

    logger.info(`WebSocket authenticated and upgraded for user ${decoded.id}`);

  } catch (error) {
    logger.warn(`WebSocket authentication failed: ${error}`);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
  const message = err.message || "Internal server error";
  
  logger.error(`[Gateway Error] ${err.message}`, {
    status,
    url: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  const error: ApiError = {
    status,
    message,
    success: false,
  };
  
  sendErrorResponse(res, error);
});

// ⭐ Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const startServer = async () => {
  try {
    await connectRedis();
    logger.info("Redis connection established");

    const PORT = app_config.port || 3000;
    server.listen(PORT, () => {
      logger.info(`API Gateway running on port ${PORT}`);
    });
  } catch (err: unknown) {
    logger.error("Failed to start server", {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    process.exit(1);
  }
};

startServer();
