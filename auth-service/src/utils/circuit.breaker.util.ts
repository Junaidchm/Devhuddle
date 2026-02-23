import CircuitBreaker from "opossum";
import logger from "./logger.util";

const defaultOptions: CircuitBreaker.Options = {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
};

export const createCircuitBreaker = <TArgs extends any[], TResult>(
    action: (...args: TArgs) => Promise<TResult>,
    name: string,
    options: CircuitBreaker.Options = {}
): CircuitBreaker<TArgs, TResult> => {
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

    breaker.on("failure", (error) => {
        logger.error(`❌ Circuit Breaker FAILURE: ${name}`, {
            error: error.message,
        });
    });

    return breaker;
};
