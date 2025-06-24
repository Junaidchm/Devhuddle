import winston from "winston";

// initializing logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVE,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/api-gateway.log" }),
  ],
});