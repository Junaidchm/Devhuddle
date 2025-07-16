
import CircuitBreaker from "opossum";
import { backOff } from 'exponential-backoff';
import { logger } from './logger';

// Numeric gRPC status codes
const GRPC_STATUS = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
};

export function createGrpcBreaker<T, R>(
  methodName: string,
  grpcCallFn: (data: T) => Promise<R>
): (data: T) => Promise<R> {
  logger.info(`Setting up circuit breaker for method: ${methodName}`);

  const breaker = new CircuitBreaker(
    async (data: T) => {
      logger.debug(`Attempting gRPC call for ${methodName}`, data);
      const result = await backOff(() => grpcCallFn(data), {
        numOfAttempts: 3,
        startingDelay: 500,
        timeMultiple: 2,
        maxDelay: 10000,
        jitter: 'full',
      });
      logger.debug(`gRPC call for ${methodName} succeeded`);
      return result;
    },
    {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 70, // Open circuit if 70% of requests fail
      resetTimeout: 10000, // 30 seconds before half-open
      name: `${methodName}-Breaker`,
      rollingCountTimeout: 15000, // 15-second window
      rollingCountBuckets: 15, // 1-second buckets
      errorFilter: (err: any) => {
        const ignoredCodes = [
          GRPC_STATUS.CANCELLED, // 1
          GRPC_STATUS.INVALID_ARGUMENT, // 3
          GRPC_STATUS.NOT_FOUND, // 5
          GRPC_STATUS.ALREADY_EXISTS, // 6
          GRPC_STATUS.PERMISSION_DENIED, // 7
          GRPC_STATUS.FAILED_PRECONDITION, // 9
          GRPC_STATUS.ABORTED, // 10
          GRPC_STATUS.OUT_OF_RANGE, // 11
          GRPC_STATUS.UNAUTHENTICATED, // 16
          GRPC_STATUS.RESOURCE_EXHAUSTED, // 8
        ];
        return ignoredCodes.includes(err.code);
      },
    }
  );

  // Event listeners
  breaker.on('open', () => logger.warn(`Circuit for ${methodName} is OPEN`, { stats: breaker.stats }));
  breaker.on('halfOpen', () => logger.info(`Circuit for ${methodName} is HALF-OPEN`, { stats: breaker.stats }));
  breaker.on('close', () => logger.info(`Circuit for ${methodName} is CLOSED`, { stats: breaker.stats }));
  breaker.on('failure', (err:any) => logger.error(`Circuit breaker failure for ${methodName}`, { error: err.message, code: err.code, stats: breaker.stats }));
  breaker.on('timeout', () => logger.warn(`Circuit breaker timeout for ${methodName}`, { stats: breaker.stats }));
  breaker.on('fallback', (result) => {
    logger.error(`[FALLBACK] Circuit breaker fallback triggered for ${methodName}`, {
      result,
      stats: breaker.stats,
    });
  });

  // Fallback logic
  breaker.fallback((err: any, data: T) => {
    const errorMessage = err?.message || 'auth-service unavailable';
    logger.error(`[FALLBACK] Circuit breaker fallback for ${methodName}`, { error: errorMessage, code: err?.code, data });
    throw new Error(`${methodName} failed: ${errorMessage}`);
  });

  return (data: T) => {
    logger.info(`[FIRE] Firing circuit breaker for ${methodName}`);
    return breaker.fire(data);
  };
}