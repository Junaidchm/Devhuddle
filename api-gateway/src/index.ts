import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import { HttpStatus } from "./utils/constents";
import { logger } from "./utils/logger";
import { rateLimiter } from "./middleware/rate-limit.middleware";
import { sendErrorResponse } from "./utils/error.util";
import { ApiError } from "./types/auth";
import cors from "cors";
import { authServiceProxy } from "./middleware/authserver.proxy.middleware";
import authRouter from "./routes/authservice/auth.routes";
import feedRouter from "./routes/feedService/feed.routes";
import { connectRedis } from "./utils/redis.util";

dotenv.config();

// create app
const app = express();

app.use(
  cors({
    origin: [process.env.frontend_URL!],
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

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({ status: "API Gateway is running" });
});

// HTTP proxy for Google OAuth routes
app.use("/auth/google", authServiceProxy);
app.use("/auth/google/callback", authServiceProxy);
app.use("/auth/admin", authServiceProxy);

// grpc rpc routing
app.use("/auth", authRouter);
app.use("/feed", feedRouter);

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

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
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
