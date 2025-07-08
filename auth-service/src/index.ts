import compression from "compression";
import dotenv from "dotenv";
import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import logger from "./utils/logger.util";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import { CustomError, sendErrorResponse } from "./utils/error.util";
import { connectPrisma } from "./config/prisma.config";
import { connectRedis } from "./utils/redis.util";
import passport from "./config/passport.config";

dotenv.config();

const app: Express = express();

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "Auth Service is running" });
});

app.use("/", authRoutes);
app.use("/admin", adminRoutes);

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
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
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
