
// error.util.ts
import { Response } from "express";
import { ApiError } from "../types/auth";
import { logger } from "./logger";

export const sendErrorResponse = (res: Response, error: ApiError): void => {
  if (!res || typeof res.status !== "function") {
    logger.error("Invalid response object in sendErrorResponse", {
      res: res ? JSON.stringify(res) : "undefined",
      error: error.message,
    });
    return; // Exit to prevent crash
  }

  logger.error(`Error: ${error.message} (Status: ${error.status})`);
  res.status(error.status).json(error);
};