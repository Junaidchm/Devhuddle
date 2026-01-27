import dotenv from "dotenv";
dotenv.config();

import compression from "compression";
import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import logger from "./utils/logger.util";
import { CustomError, sendErrorResponse } from "./utils/error.util";
import { app, startServer } from "./utils/server.start.util";
import { extractUserFromHeader } from "./middlewares/auth.middleware";

// Import repositories
import { MediaRepository } from "./repositories/impliments/media.repository";

// Import services
import { MediaService } from "./services/impliments/media.service";

// Import controllers
import { MediaController } from "./controllers/impliments/media.controller";

// Import routes
import { setupMediaRoutes } from "./routes/media.routes";

dotenv.config();

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize repositories
const mediaRepository = new MediaRepository();

// Initialize services
const mediaService = new MediaService(mediaRepository);

// Initialize controllers
const mediaController = new MediaController(mediaService);

// Setup routes
const mediaRouter = setupMediaRoutes(mediaController);

// Register auth middleware
app.use(extractUserFromHeader);

app.use("/api/v1/media", mediaRouter);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "Media service is running" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  sendErrorResponse(
    res,
    err instanceof CustomError
      ? err
      : { status: 500, message: "Internal server error" }
  );
});

startServer().then(() => {
  logger.info("Media Service started successfully");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

