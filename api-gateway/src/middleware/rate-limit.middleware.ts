import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { logger } from "../utils/logger";
import { Request } from "express";
import redisClient from "../utils/redis.util";


export const rateLimiter = rateLimit({
  // redis store config
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per IP,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: async (req: Request) => {
    const error: { status: number; message: string } = {
      status: 429,
      message: "Too many requests, please try again later",
    };
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    return error;
  },
});
