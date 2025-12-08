import winston from "winston";
import path from "path";

const logDir = path.join(process.cwd(), "logs");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "media-service" },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "media-service-error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(logDir, "media-service.log"),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;

