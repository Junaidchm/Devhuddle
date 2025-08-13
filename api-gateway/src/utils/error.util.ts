
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
  res.status(error.status).json(error);
};

export function filterError(err:Error) {
  console.log(err.message)
  return err.message.split(':')[1]
}