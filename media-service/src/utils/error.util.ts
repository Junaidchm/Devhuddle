import { Response } from "express";
import logger from "./logger.util";

export class CustomError extends Error {
  status: number;
  message: string;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.message = message;
    this.name = "CustomError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export const sendErrorResponse = (
  res: Response,
  error: CustomError | { status: number; message: string }
) => {
  const status = error.status || 500;
  const message = error.message || "Internal server error";

  logger.error("Error response", {
    status,
    message,
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(status).json({
    success: false,
    error: {
      status,
      message,
    },
  });
};

