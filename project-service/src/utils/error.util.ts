import { Response } from "express";
import { ApiError } from "../types/error";
import logger from "./logger.util";


export class CustomError extends Error {
  status: number;
  success: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.success = false;
  }
}

export const sendErrorResponse = (res: Response, error: ApiError) => {
  logger.error(error.message, { status: error.status });
  res
    .status(error.status)
    .json({
      status: error.status,
      message: error.message,
      success: error.success,
    });
};

