import { HttpStatus } from "../utils/constents";

// gRPC to HTTP status code mapping
export const grpcToHttp: Record<number, number> = {
  0: HttpStatus.OK,                             // OK
  1: HttpStatus.REQUEST_TIMEOUT,                // CANCELLED
  2: HttpStatus.INTERNAL_SERVER_ERROR,          // UNKNOWN
  3: HttpStatus.BAD_REQUEST,                    // INVALID_ARGUMENT
  4: HttpStatus.REQUEST_TIMEOUT,                // DEADLINE_EXCEEDED
  5: HttpStatus.NOT_FOUND,                      // NOT_FOUND
  6: HttpStatus.CONFLICT,                       // ALREADY_EXISTS
  7: HttpStatus.FORBIDDEN,                      // PERMISSION_DENIED
  8: HttpStatus.TOO_MANY_REQUESTS,              // RESOURCE_EXHAUSTED
  9: HttpStatus.BAD_REQUEST,                    // FAILED_PRECONDITION
  10: HttpStatus.CONFLICT,                      // ABORTED
  11: HttpStatus.BAD_REQUEST,                   // OUT_OF_RANGE
  12: HttpStatus.NOT_IMPLEMENTED,               // UNIMPLEMENTED
  13: HttpStatus.INTERNAL_SERVER_ERROR,         // INTERNAL
  14: HttpStatus.SERVICE_UNAVAILABLE,           // UNAVAILABLE
  15: HttpStatus.INTERNAL_SERVER_ERROR,         // DATA_LOSS
  16: HttpStatus.UNAUTHORIZED,                  // UNAUTHENTICATED
};
