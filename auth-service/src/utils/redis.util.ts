import redisClient from "../config/redis.config";
import { SuggestedUser } from "../types/auth";
import logger from "./logger.util";

export const generateBlockUserRedisKey = (sensitive: string): string => {
  return `blacklist:user:${sensitive}`;
};

export class RedisCacheService {
  private static readonly CACHE_KEYS = {
    FOLLOWER_COUNT: (userId: string) => `user:followers:count:${userId}`,
    SUGGESTIONS: (userId: string) => `suggestions:${userId}`,
    USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  };

  private static readonly TTL = {
    FOLLOWER_COUNT: 3600, // 1 hour
    SUGGESTIONS: 300, // 5 minutes
    USER_PROFILE: 1800, // 30 minutes
  };

  /**
   * Increment follower count with write-through caching
   */
  static async incrementFollowerCount(userId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.FOLLOWER_COUNT(userId);
      const count = await redisClient.incr(key);
      await redisClient.expire(key, this.TTL.FOLLOWER_COUNT);

      logger.info(`Follower count incremented for user ${userId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error incrementing follower count", { error, userId });
      throw error;
    }
  }

  /**
   * Decrement follower count with write-through caching
   */
  static async decrementFollowerCount(userId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.FOLLOWER_COUNT(userId);
      const count = await redisClient.decr(key);
      await redisClient.expire(key, this.TTL.FOLLOWER_COUNT);

      logger.info(`Follower count decremented for user ${userId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error decrementing follower count", { error, userId });
      throw error;
    }
  }

  /**
   * Get cached follower count
   */
  static async getFollowerCount(userId: string): Promise<number | null> {
    try {
      const key = this.CACHE_KEYS.FOLLOWER_COUNT(userId);
      const count = await redisClient.get(key);
      return count ? parseInt(count, 10) : null;
    } catch (error) {
      logger.error("Error getting follower count from cache", {
        error,
        userId,
      });
      return null;
    }
  }

  /**
   * Invalidate Suggestions Cache
   */
  static async invalidateSuggestionsCache(userId: string): Promise<void> {
    const key = this.CACHE_KEYS.SUGGESTIONS(userId);
    await redisClient.del(key);
  }

  /**
   * Invalidate user-related caches
   */
  static async invalidateUserCaches(userId: string): Promise<void> {
    try {
      const patterns = [
        this.CACHE_KEYS.SUGGESTIONS(userId),
        this.CACHE_KEYS.USER_PROFILE(userId),
      ];

      for (const pattern of patterns) {
        await redisClient.del(pattern);
      }

      logger.info(`Invalidated caches for user ${userId}`);
    } catch (error) {
      logger.error("Error invalidating user caches", { error, userId });
    }
  }

  /**
   * Cache user suggestions
   */
  static async cacheSuggestions(
    userId: string,
    suggestions: SuggestedUser[],
    ttl: number = this.TTL.SUGGESTIONS
  ): Promise<void> {
    try {
      const key = this.CACHE_KEYS.SUGGESTIONS(userId);
      await redisClient.setEx(key, ttl, JSON.stringify(suggestions));
      logger.info(`Cached suggestions for user ${userId}`);
    } catch (error) {
      logger.error("Error caching suggestions", { error, userId });
      throw error; // Re-throw to catch in calling function
    }
  }

  /**
   * Get cached suggestions
   */
  static async getCachedSuggestions(
    userId: string
  ): Promise<SuggestedUser[] | null> {
    try {
      const key = this.CACHE_KEYS.SUGGESTIONS(userId);
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error("Error getting cached suggestions", { error, userId });
      return null;
    }
  }

  /**
   *  New method to queue background invalidation for impacted users
   */

  static async queueSuggestionInvalidation(userIds: string[]): Promise<void> {
    // Add to Redis list for background processing
    try {
      if (userIds.length > 0) {
        const values = userIds.map((id) => JSON.stringify({ userId: id, timestamp: Date.now() }));
        await redisClient.rPush("suggestion:invalidation:queue", values);
      }
    } catch (error) {
      logger.error("Error queueing suggestion invalidation", { error, userIds });
    }
  }
}
