import compression from "compression";
import dotenv from "dotenv";
import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import logger from "./utils/logger.util";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import followRoutes from "./routes/follow.routes";
import { CustomError, sendErrorResponse } from "./utils/error.util";
import { connectPrisma } from "./config/prisma.config";
import passport from "./config/passport.config";
import grpcServer from "./grpc-server";
import { connectRedis } from "./config/redis.config";
import { startCompensationConsumer } from "./consumers/compensation.consumer";
import userRoutes from "./routes/user.routes";

dotenv.config();

const app: Express = express();

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`, {
    headers: {
      contentType: req.headers["content-type"],
      userAgent: req.headers["user-agent"],
    },
    body: req.method === "POST" ? { email: (req.body as any)?.email } : undefined,
  });
  next();
});

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "Auth Service is running" });
});

// API routes (API Gateway removes /api/v1 prefix before forwarding)
// So service receives: /auth/*, /users/*, /users/follows/*, /auth/admin/*

// Auth routes: receives /auth/* after gateway removes /api/v1
app.use("/auth", authRoutes);

// User routes: receives /users/* after gateway removes /api/v1
// Changed from /profile to /users to match API Gateway structure
app.use("/users", userRoutes);

// Follow routes: receives /users/follows/* after gateway removes /api/v1
app.use("/users/follows", followRoutes);

// Admin routes: receives /auth/admin/* after gateway removes /api/v1
app.use("/auth/admin", adminRoutes);


app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  sendErrorResponse(
    res,
    err instanceof CustomError
      ? err
      : { status: 500, message: "Internal server error" }
  );
});

const startServer = async () => {
  try {
    logger.info("Prisma connection established");
    await connectPrisma();

    await connectRedis();
    logger.info("Redis connection established");

    await startCompensationConsumer();
    logger.info("Compensation consumer started");
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
    });
    grpcServer;
  } catch (err: any) {
    logger.error("Failed to start server", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
};

startServer();
