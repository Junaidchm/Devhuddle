import { Response } from "express";
import { ApiError } from "../types/auth";
import logger from "./logger.util";
import * as grpc from "@grpc/grpc-js";
import { HttpStatus } from "../constents/httpStatus";


export class CustomError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Convert gRPC status codes to HTTP status codes
 * This ensures proper HTTP status codes are returned to clients
 */
export const grpcStatusToHttp = (grpcStatus: number): number => {
  const mapping: Record<number, number> = {
    [grpc.status.OK]: HttpStatus.OK,                              // 0 -> 200
    [grpc.status.CANCELLED]: HttpStatus.REQUEST_TIMEOUT,         // 1 -> 408
    [grpc.status.UNKNOWN]: HttpStatus.INTERNAL_SERVER_ERROR,       // 2 -> 500
    [grpc.status.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,       // 3 -> 400
    [grpc.status.DEADLINE_EXCEEDED]: HttpStatus.REQUEST_TIMEOUT, // 4 -> 408
    [grpc.status.NOT_FOUND]: HttpStatus.NOT_FOUND,                // 5 -> 404
    [grpc.status.ALREADY_EXISTS]: HttpStatus.CONFLICT,           // 6 -> 409
    [grpc.status.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,       // 7 -> 403
    [grpc.status.RESOURCE_EXHAUSTED]: HttpStatus.TOO_MANY_REQUESTS, // 8 -> 429
    [grpc.status.FAILED_PRECONDITION]: HttpStatus.BAD_REQUEST,    // 9 -> 400
    [grpc.status.ABORTED]: HttpStatus.CONFLICT,                    // 10 -> 409
    [grpc.status.OUT_OF_RANGE]: HttpStatus.BAD_REQUEST,            // 11 -> 400
    [grpc.status.UNIMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,      // 12 -> 501
    [grpc.status.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,     // 13 -> 500
    [grpc.status.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,    // 14 -> 503
    [grpc.status.DATA_LOSS]: HttpStatus.INTERNAL_SERVER_ERROR,    // 15 -> 500
    [grpc.status.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,       // 16 -> 401
  };

  // If it's already an HTTP status code (200-599), return as-is
  if (grpcStatus >= 200 && grpcStatus < 600) {
    return grpcStatus;
  }

  // Otherwise, map from gRPC to HTTP
  return mapping[grpcStatus] || HttpStatus.INTERNAL_SERVER_ERROR;
};

export const sendErrorResponse = (res: Response, error: ApiError) => {
  // Convert gRPC status codes to HTTP status codes
  const httpStatus = grpcStatusToHttp(error.status);
  
  logger.error(error.message, { 
    grpcStatus: error.status,
    httpStatus,
    message: error.message 
  });
  
  res
    .status(httpStatus)
    .json({
      success: false,
      status: httpStatus,
      message: error.message,
    });
};
