// import { createClient } from "redis";
// import { logger } from "../utils/logger";

// // create client
// const redisClient = createClient({
//   url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
// });

// redisClient.on("error", (err) =>
//   logger.error(logger.error(`Redis error: ${err.message}`))
// );
// redisClient.on('connect', () => logger.info('Connected to Redis'));
// redisClient.on('reconnecting', () => logger.info('Reconnecting to Redis'));

// // Connect once at startup
// redisClient.connect().catch((err) => logger.error(`Redis connection error: ${err.message}`));

// export default redisClient;