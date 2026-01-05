import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { HttpStatus } from "../utils/constents";
import { filterError, sendErrorResponse } from "../utils/error.util";
import { grpcToHttp } from "../constants/http.status";

type ControllerFunction<T> = (req: Request) => Promise<{
  status: number;
  data: T;
}>;

export const controllerWrapper = 
  <T>(handler: ControllerFunction<T>) =>
  async (req: Request, res: Response) => {
    try {
      const { status, data } = await handler(req);
      res.status(status).json(data);
    } catch (err: unknown) {
      const error = err as any;
      logger.error(`Error in request`, { error: error.message });
      const statusCode = grpcToHttp[error.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(error) || "Server error",
      });
    }
  };