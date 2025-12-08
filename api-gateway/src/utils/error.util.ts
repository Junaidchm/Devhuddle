
// error.util.ts
import { Response } from "express";
import { ApiError } from "../types/auth";
import { logger } from "./logger";

export class CustomError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const sendErrorResponse = (res: Response, error: ApiError): void => {
  console.log('this is the error status',error.status)
  logger.error(`Error: ${error.message} (Status: ${error.status})`);
  // Explicitly create a plain object to ensure proper JSON serialization
  // Error objects don't serialize well, so we extract the properties
  const errorResponse: ApiError = {
    status: error.status,
    message: error.message,
    success: false,
  };
  res.status(error.status).json(errorResponse);
};

export function filterError(err:Error) {
  console.log(err.message)
  return err.message.split(':')[1]
}