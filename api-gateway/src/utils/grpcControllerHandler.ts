// utils/grpcControllerHandler.ts
import { Response } from "express";
import { logger } from "./logger";
import { HttpStatus } from "./constents";
import { grpcToHttp } from "../constants/http.status";
import { filterError, sendErrorResponse } from "./error.util";

export const handleGrpcCall = async <TRequest, TResponse>(
  res: Response,
  actionName: string,
  grpcFn: () => Promise<TResponse>,
  onSuccess?: (response: TResponse) => any
) => {
  try {
    const response = await grpcFn();
    res.status(HttpStatus.OK).json({
      success: true,
      ...(onSuccess ? onSuccess(response) : { data: response }),
    });
  } catch (err: any) {
    logger.error(`Error in ${actionName}`, {
      error: err.message,
    //   stack: err.stack,
    });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};
