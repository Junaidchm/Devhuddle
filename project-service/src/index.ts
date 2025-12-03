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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof CustomError) {
    // Convert gRPC status codes to HTTP status codes if needed
    // gRPC status codes are typically 0-16, HTTP status codes are 100-599
    let httpStatus = err.status;
    if (err.status >= 0 && err.status <= 16) {
      // This is a gRPC status code, convert it
      const { grpcToHttpStatus } = require("./utils/status.mapper");
      httpStatus = grpcToHttpStatus(err.status);
    }
    sendErrorResponse(
      res,
      { status: httpStatus, message: err.message, success: false }
    );
  } else {
    logger.error("Unhandled error", { error: err.message, stack: err.stack });
    sendErrorResponse(
      res,
      { status: 500, message: err.message || "Internal server error", success: false }
    );
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

