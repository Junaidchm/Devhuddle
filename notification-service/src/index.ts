import express, { Express, NextFunction, Request, Response } from "express";
import { startFollowConsumer } from "./consumers/follow.consumer";
import { connectRedis } from "./config/redis.config";
import { createServer } from "http";
import { HttpStatus } from "./constents/httpStatus";
import logger from "./utils/logger.util";
import notificationRoutes from "./routes/notification.routes";
import dlqRoutes from "./routes/dlq.routes";
import { WebSocketService } from "./utils/websocket.util";
import { startDLQConsumer } from "./consumers/dlq.consumers";

const app: Express = express();
const server = createServer(app);

// Log all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
// app.use((req: Request, res: Response, next: NextFunction) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header(
//     "Access-Control-Allow-Methods",
//     "GET, POST, PUT, DELETE, PATCH, OPTIONS"
//   );
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested-With, Content-Type, Accept, Authorization"
//   );
//   if (req.method === "OPTIONS") {
//     res.sendStatus(200);
//   } else {
//     next();
//   }
// });

// Health check route
app.get("/health", (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({
    status: "Notification service is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes (API Gateway keeps /api/v1 prefix for notifications)
// So service receives: /api/v1/notifications/*

// Notification routes: receives /api/v1/notifications/* from gateway
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/admin/dlq`, dlqRoutes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Error in notification service", { error: err });
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    status: "error",
    message: "Internal server error",
  });
});

const startServer = async () => {
  try {
    // Connect to Redis
    await connectRedis();
    logger.info("Connected to Redis");

    // Initialize WebSocket service
    const wsService = new WebSocketService(server);
    logger.info("WebSocket service initialized");

    // Start Kafka consumers and pass WebSocket service instance
    await startFollowConsumer(wsService);
    // await startLikeConsumer(wsService);
    // await startCommentConsumer(wsService);
    // await startDLQConsumer(); // DLQ might not need wsService
    logger.info("All Kafka consumers started");

    // Start HTTP server
    const PORT = process.env.PORT || 4001;
    server.listen(PORT, () => {
      logger.info(`Notification service running on port ${PORT}`);
      logger.info(`WebSocket server running on ws://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start notification server:", error);
    process.exit(1);
  }
};

startServer();
