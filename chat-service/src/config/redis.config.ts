import logger from "../utils/logger.util";
import { createClient } from "redis";

// Main Redis client for general cache operations
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err: any) => {
  logger.error("Redis Client Error", { error: err.message });
});

redisClient.on("connect", () => {
  logger.info("Redis client connected");
});

// Redis Publisher client for publishing messages to channels
const redisPublisher = createClient({
  url: process.env.REDIS_URL,
});

redisPublisher.on("error", (err: any) => {
  logger.error("Redis Publisher Error", { error: err.message });
});

redisPublisher.on("connect", () => {
  logger.info("Redis publisher connected");
});

// Redis Subscriber client for subscribing to channels
const redisSubscriber = createClient({
  url: process.env.REDIS_URL,
});

redisSubscriber.on("error", (err: any) => {
  logger.error("Redis Subscriber Error", { error: err.message });
});

redisSubscriber.on("connect", () => {
  logger.info("Redis subscriber connected");
});

// Connect all Redis clients
export const connectRedis = async () => {
  try {
    // Connect main client
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info("Main Redis client connected successfully");
    }

    // Connect publisher client
    if (!redisPublisher.isOpen) {
      await redisPublisher.connect();
      logger.info("Redis publisher connected successfully");
    }

    // Connect subscriber client
    if (!redisSubscriber.isOpen) {
      await redisSubscriber.connect();
      logger.info("Redis subscriber connected successfully");
    }
  } catch (error: unknown) {
    logger.error("Failed to connect to Redis", {
      error: (error as Error).message,
    });
    throw error;
  }
};

export { redisPublisher, redisSubscriber };
export default redisClient;
