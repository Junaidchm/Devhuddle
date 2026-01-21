import redisClient from "../config/redis.config";
import logger from './logger.util';

/**
 * Redis caching utility for chat service
 * Implements caching with TTL and proper invalidation
 */

const CACHE_TTL = {
  CONVERSATION: 3600,      // 1 hour
  MESSAGES: 1800,          // 30 minutes
  USER_CONVERSATIONS: 600, // 10 minutes
  USER_CONVERSATIONS_METADATA: 120, // 2 minutes (highly dynamic data)
  PARTICIPANTS: 3600       // 1 hour
};

export class RedisCacheService {
  
  /**
   * Cache conversation data
   */
  static async cacheConversation(conversationId: string, data: any): Promise<void> {
    try {
      const key = `conversation:${conversationId}`;
      await redisClient.setEx(key, CACHE_TTL.CONVERSATION, JSON.stringify(data));
      logger.debug('Cached conversation', { conversationId });
    } catch (error) {
      logger.error('Failed to cache conversation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        conversationId
      });
    }
  }

  /**
   * Get cached conversation
   */
  static async getCachedConversation(conversationId: string): Promise<any | null> {
    try {
      const key = `conversation:${conversationId}`;
      const cached = await redisClient.get(key);
      if (cached) {
        logger.debug('Cache hit for conversation', { conversationId });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached conversation', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Cache messages for a conversation
   */
  static async cacheMessages(conversationId: string, limit: number, offset: number, messages: any[]): Promise<void> {
    try {
      const key = `messages:${conversationId}:${limit}:${offset}`;
      await redisClient.setEx(key, CACHE_TTL.MESSAGES, JSON.stringify(messages));
      logger.debug('Cached messages', { conversationId, count: messages.length });
    } catch (error) {
      logger.error('Failed to cache messages', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cached messages
   */
  static async getCachedMessages(conversationId: string, limit: number, offset: number): Promise<any[] | null> {
    try {
      const key = `messages:${conversationId}:${limit}:${offset}`;
      const cached = await redisClient.get(key);
      if (cached) {
        logger.debug('Cache hit for messages', { conversationId });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached messages', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Cache user's conversations
   */
  static async cacheUserConversations(userId: string, conversations: any[]): Promise<void> {
    try {
      const key = `user:${userId}:conversations`;
      await redisClient.setEx(key, CACHE_TTL.USER_CONVERSATIONS, JSON.stringify(conversations));
      logger.debug('Cached user conversations', { userId, count: conversations.length });
    } catch (error) {
      logger.error('Failed to cache user conversations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cached user conversations
   */
  static async getCachedUserConversations(userId: string): Promise<any[] | null> {
    try {
      const key = `user:${userId}:conversations`;
      const cached = await redisClient.get(key);
      if (cached) {
        logger.debug('Cache hit for user conversations', { userId });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached user conversations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Invalidate conversation cache when new message is sent
   */
  static async invalidateConversationCache(conversationId: string): Promise<void> {
    try {
      const pattern = `messages:${conversationId}:*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.debug('Invalidated message cache', { conversationId, keysDeleted: keys.length });
      }

      // Also invalidate conversation cache
      await redisClient.del(`conversation:${conversationId}`);
    } catch (error) {
      logger.error('Failed to invalidate cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Invalidate user's conversation list cache
   */
  static async invalidateUserConversationsCache(userId: string): Promise<void> {
    try {
      await redisClient.del(`user:${userId}:conversations`);
      logger.debug('Invalidated user conversations cache', { userId });
    } catch (error) {
      logger.error('Failed to invalidate user conversations cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cache user's conversations with metadata (enriched with last message, unread count, user profiles)
   */
  static async cacheUserConversationsWithMetadata(
    userId: string,
    limit: number,
    offset: number,
    conversations: any[]
  ): Promise<void> {
    try {
      const key = `user:${userId}:conversations:metadata:${limit}:${offset}`;
      await redisClient.setEx(
        key,
        CACHE_TTL.USER_CONVERSATIONS_METADATA,
        JSON.stringify(conversations)
      );
      logger.debug('Cached user conversations with metadata', {
        userId,
        count: conversations.length,
        limit,
        offset
      });
    } catch (error) {
      logger.error('Failed to cache user conversations with metadata', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cached user conversations with metadata
   */
  static async getCachedUserConversationsWithMetadata(
    userId: string,
    limit: number,
    offset: number
  ): Promise<any[] | null> {
    try {
      const key = `user:${userId}:conversations:metadata:${limit}:${offset}`;
      const cached = await redisClient.get(key);
      if (cached) {
        logger.debug('Cache hit for user conversations with metadata', {
          userId,
          limit,
          offset
        });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached user conversations with metadata', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Invalidate user's conversation metadata cache
   * Called when new messages are sent to update the conversation list
   */
  static async invalidateUserConversationsMetadataCache(userId: string): Promise<void> {
    try {
      const pattern = `user:${userId}:conversations:metadata:*`;
      const keys = await redisClient.keys(pattern);

      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.debug('Invalidated user conversations metadata cache', {
          userId,
          keysDeleted: keys.length
        });
      }
    } catch (error) {
      logger.error('Failed to invalidate user conversations metadata cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generic get method for custom cache keys
   */
  static async get(key: string): Promise<string | null> {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        logger.debug('Cache hit', { key });
      }
      return cached;
    } catch (error) {
      logger.error('Failed to get from cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
      return null;
    }
  }

  /**
   * Generic set method for custom cache keys with TTL
   */
  static async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await redisClient.setEx(key, ttlSeconds, value);
      logger.debug('Cached data', { key, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Failed to cache data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
    }
  }
}

