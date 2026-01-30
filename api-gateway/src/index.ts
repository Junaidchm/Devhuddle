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
import { ROUTES } from "./constants/routes";
import { engagementServiceProxy } from "./middleware/engagement.proxy.middleware";
import { adminServiceProxy } from "./middleware/admin.proxy.middleware";
import { chatServiceProxy } from "./middleware/chat.proxy.middleware";
import { verifyAccessToken } from "./utils/jwt.util";

dotenv.config();

// create app
const app = express();
const server = createServer(app);

app.use(
  cors({
    origin: [app_config.frontend_URL!],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  })
);


app.use(express.json({
  limit: '10mb', // 10MB limit for JSON payloads (sufficient for UploadThing callbacks)
  verify: (req: Request, res, buf) => {
    // Store raw body for potential signature verification
    (req as any).rawBody = buf;
  },
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
}));


// Log all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ============================================
// HTTP Proxy Routes (forwarded to microservices)
// ============================================

app.use(ROUTES.AUTH.BASE, conditionalJwtMiddleware, authServiceProxy);
app.use(ROUTES.USERS.BASE, conditionalJwtMiddleware, authServiceProxy);


app.use(ROUTES.FEED.BASE, conditionalJwtMiddleware, postServiceProxy);

app.use(
  ROUTES.MEDIA.BASE,
  conditionalJwtMiddleware,
  mediaServiceProxy
);

app.use(
  ROUTES.NOTIFICATIONS.BASE,
  conditionalJwtMiddleware,
  notificationServiceProxy
);

app.use(
  ROUTES.ENGAGEMENT.BASE,
  conditionalJwtMiddleware,
  engagementServiceProxy
);


// app.use(ROUTES.PROJECTS.BASE, conditionalJwtMiddleware, projectServiceProxy);


app.use(ROUTES.ADMIN.BASE, conditionalJwtMiddleware, adminServiceProxy);

// Chat Service Route
app.use(
  "/api/v1/chat",
  conditionalJwtMiddleware,
  chatServiceProxy
);

// Health check
app.get(ROUTES.HEALTH, (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({ status: "API Gateway is running" });
});

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
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const error: ApiError = {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: err.message || "Internal server error",
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
