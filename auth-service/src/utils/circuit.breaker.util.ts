import CircuitBreaker from "opossum";
import logger from "./logger.util";

type CircuitBreakerOptions = {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    rollingCountTimeout?: number;
    rollingCountBuckets?: number;
    name?: string;
};

const defaultOptions: CircuitBreakerOptions = {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
};

export const createCircuitBreaker = <TArgs extends any[], TResult>(
    action: (...args: TArgs) => Promise<TResult>,
    name: string,
    options: CircuitBreakerOptions = {}
) => {
    const breaker = new CircuitBreaker(action, {
        ...defaultOptions,
        ...options,
        name,
    });

    breaker.on("open", () => {
        logger.warn(`🔴 Circuit Breaker OPEN: ${name} - Service is unavailable`);
    });

    breaker.on("halfOpen", () => {
        logger.info(`🟡 Circuit Breaker HALF-OPEN: ${name} - Testing service recovery`);
    });

    breaker.on("close", () => {
        logger.info(`🟢 Circuit Breaker CLOSED: ${name} - Service recovered`);
    });

    (breaker as any).on("fallback", (_result: TResult) => {
        logger.warn(`⚠️ Circuit Breaker FALLBACK: ${name} - Using fallback mechanism`);
    });

    breaker.on("failure", (error: Error) => {
        logger.error(`❌ Circuit Breaker FAILURE: ${name}`, {
            error: error.message,
        });
    });

    return breaker;
};
