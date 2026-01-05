import compression from "compression";
import dotenv from "dotenv";
import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import logger from "./utils/logger.util";
import { CustomError, sendErrorResponse } from "./utils/error.util";
import { app, startServer } from "./utils/server.start.util";
import { OutboxProcessor } from "./services/impliments/outbox.processor";

// Import repositories
import { ProjectRepository } from "./repositories/impliments/project.repository";
import { ProjectLikeRepository } from "./repositories/impliments/project.like.repository";
import { ProjectShareRepository } from "./repositories/impliments/project.share.repository";
import { ProjectReportRepository } from "./repositories/impliments/project.report.repository";
import { ProjectMediaRepository } from "./repositories/impliments/project.media.repository";
import { OutboxRepository } from "./repositories/impliments/outbox.repository";
import { IdempotencyRepository } from "./repositories/impliments/idempotency.repository";

// Import services
import { ProjectService } from "./services/impliments/project.service";
import { ProjectLikeService } from "./services/impliments/project.like.service";
import { ProjectShareService } from "./services/impliments/project.share.service";
import { ProjectReportService } from "./services/impliments/project.report.service";
import { ProjectMediaService } from "./services/impliments/project.media.service";
import { OutboxService } from "./services/impliments/outbox.service";

// Import controllers
import { ProjectController } from "./controllers/impliments/project.controller";
import { ProjectLikeController } from "./controllers/impliments/project.like.controller";
import { ProjectShareController } from "./controllers/impliments/project.share.controller";
import { ProjectReportController } from "./controllers/impliments/project.report.controller";
import { ProjectMediaController } from "./controllers/impliments/project.media.controller";

// Import routes
import { setupProjectRoutes } from "./routes/project.routes";
import { disconnectProducer, disconnectAdmin } from "./utils/kafka.util";

dotenv.config();

app.use(helmet());
app.use(compression());

// Body parser middleware with proper limits and error handling
app.use(express.json({
  limit: '10mb', // 10MB limit for JSON payloads
  verify: (req: Request, res, buf) => {
    // Store raw body for potential signature verification
    (req as any).rawBody = buf;
  },
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
}));

app.use(cookieParser());

// Initialize repositories
const projectRepository = new ProjectRepository();
const likeRepository = new ProjectLikeRepository();
const shareRepository = new ProjectShareRepository();
const reportRepository = new ProjectReportRepository();
const mediaRepository = new ProjectMediaRepository();
const outboxRepository = new OutboxRepository();
const idempotencyRepository = new IdempotencyRepository();

// Initialize services
const outboxService = new OutboxService(outboxRepository);
const outboxProcessor = new OutboxProcessor(outboxRepository);
const projectService = new ProjectService(
  projectRepository,
  likeRepository,
  shareRepository,
  outboxService
);
const likeService = new ProjectLikeService(
  likeRepository,
  projectRepository,
  outboxService
);
const shareService = new ProjectShareService(
  shareRepository,
  projectRepository,
  outboxService
);
const reportService = new ProjectReportService(
  reportRepository,
  projectRepository,
  outboxService
);
const mediaService = new ProjectMediaService(mediaRepository);

// Initialize controllers
const projectController = new ProjectController(projectService);
const likeController = new ProjectLikeController(likeService);
const shareController = new ProjectShareController(shareService);
const reportController = new ProjectReportController(reportService);
const mediaController = new ProjectMediaController(mediaService);

// Setup routes
const projectRouter = setupProjectRoutes(
  projectController,
  likeController,
  shareController,
  reportController,
  mediaController,
  idempotencyRepository
);

app.use("/api/v1", projectRouter);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "Project service is running" });
});

// Middleware to handle aborted requests gracefully
app.use((req: Request, res: Response, next: NextFunction) => {
  // Handle request aborted errors
  req.on('aborted', () => {
    logger.warn("Request aborted by client", {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });
  });

  // Handle client disconnect
  req.on('close', () => {
    if (!res.headersSent) {
      logger.debug("Client disconnected before response", {
        method: req.method,
        url: req.url,
      });
    }
  });

  next();
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Handle request aborted errors specifically
  if (err.message === 'request aborted' || err.message.includes('aborted')) {
    logger.warn("Request aborted", {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });
    
    // Don't send response if headers already sent or connection closed
    if (!res.headersSent && !res.writableEnded) {
      return res.status(400).json({
        status: 400,
        message: "Request was cancelled",
        success: false,
      });
    }
    return;
  }

  // Handle body parser errors
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn("Invalid JSON in request body", {
      method: req.method,
      url: req.url,
      error: err.message,
    });
    
    if (!res.headersSent && !res.writableEnded) {
      return res.status(400).json({
        status: 400,
        message: "Invalid JSON in request body",
        success: false,
      });
    }
    return;
  }

  // Handle payload too large errors
  if (err.message && err.message.includes('limit')) {
    logger.warn("Request payload too large", {
      method: req.method,
      url: req.url,
      error: err.message,
    });
    
    if (!res.headersSent && !res.writableEnded) {
      return res.status(413).json({
        status: 413,
        message: "Request payload too large",
        success: false,
      });
    }
    return;
  }

  if (err instanceof CustomError) {
    // Convert gRPC status codes to HTTP status codes if needed
    // gRPC status codes are typically 0-16, HTTP status codes are 100-599
    let httpStatus = err.status;
    if (err.status >= 0 && err.status <= 16) {
      // This is a gRPC status code, convert it
      const { grpcToHttpStatus } = require("./utils/status.mapper");
      httpStatus = grpcToHttpStatus(err.status);
    }
    
    if (!res.headersSent && !res.writableEnded) {
      sendErrorResponse(
        res,
        { status: httpStatus, message: err.message, success: false }
      );
    }
  } else {
    logger.error("Unhandled error", {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.url,
    });
    
    if (!res.headersSent && !res.writableEnded) {
      sendErrorResponse(
        res,
        { status: 500, message: "Internal server error", success: false }
      );
    }
  }
});

const startOutboxProcessor = () => {
  outboxProcessor.start();
  logger.info("Outbox processor started");
};

startServer().then(() => {
  startOutboxProcessor();
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  outboxProcessor.stop();
  await disconnectProducer();
  await disconnectAdmin();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  outboxProcessor.stop();
  await disconnectProducer();
  await disconnectAdmin();
  process.exit(0);
});

