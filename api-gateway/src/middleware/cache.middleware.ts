import { NextFunction, Request, Response } from "express";
import redisClient from "../utils/redis.util";
import { logger } from "../utils/logger";
import { CACHE_TIME } from "../utils/constents";

export const cacheMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!["GET", "POST"].includes(req.method)) {
    return next();
  }

  const key = `cache:${req.method}:${req.path}:${JSON.stringify(req.body)}`;
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      logger.info(`Cache hit: ${key}`);
      return res.json(JSON.parse(cached));
    }

    console.log('request is going after the cash ============================> ')

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 2000 && res.statusCode < 300) {
        redisClient.setEx(key, CACHE_TIME, JSON.stringify(body));
      }
      return originalJson(body);
    };
    next();
  } catch (err) {
    if (err instanceof Error) {
      logger.error(`Cache error: ${err.message}`);
    }
    next();
  }
};
