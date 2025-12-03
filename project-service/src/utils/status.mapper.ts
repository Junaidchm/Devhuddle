import * as grpc from "@grpc/grpc-js";

/**
 * Maps gRPC status codes to HTTP status codes
 */
export function grpcToHttpStatus(grpcStatus: number): number {
  const statusMap: Record<number, number> = {
    [grpc.status.OK]: 200,
    [grpc.status.CANCELLED]: 499, // Client closed request
    [grpc.status.UNKNOWN]: 500,
    [grpc.status.INVALID_ARGUMENT]: 400,
    [grpc.status.DEADLINE_EXCEEDED]: 504,
    [grpc.status.NOT_FOUND]: 404,
    [grpc.status.ALREADY_EXISTS]: 409,
    [grpc.status.PERMISSION_DENIED]: 403,
    [grpc.status.RESOURCE_EXHAUSTED]: 429,
    [grpc.status.FAILED_PRECONDITION]: 412,
    [grpc.status.ABORTED]: 409,
    [grpc.status.OUT_OF_RANGE]: 400,
    [grpc.status.UNIMPLEMENTED]: 501,
    [grpc.status.INTERNAL]: 500,
    [grpc.status.UNAVAILABLE]: 503,
    [grpc.status.DATA_LOSS]: 500,
    [grpc.status.UNAUTHENTICATED]: 401,
  };

  return statusMap[grpcStatus] || 500;
}

