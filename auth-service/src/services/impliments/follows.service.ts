import { error } from "console";
import { IFollowsRepository } from "../../repositories/interfaces/IFollowsRepository";
import { SuggestedUser } from "../../types/auth";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { IFollowsService } from "../interface/IFollowsService";
import { v4 as uuid } from "uuid";
import { publishEvent } from "../../utils/kafka.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { RedisCacheService } from "../../utils/redis.util";

export class FollowsService implements IFollowsService {
  constructor(private _followsRepository: IFollowsRepository) {}

  async getSuggestions(
    userId: string,
    limit: number = 5
  ): Promise<{ suggestedUsers: SuggestedUser[]; error?: string }> {
    try {
      const cached = await RedisCacheService.getCachedSuggestions(userId);
      if (cached) {
        logger.info(`Returning cached suggestions for user ${userId}`);
        return { suggestedUsers: cached };
      }

      const suggestedUsers =
        await this._followsRepository.getSuggestionsForUser(userId, limit);

      await RedisCacheService.cacheSuggestions(userId, suggestedUsers);

      return { suggestedUsers };
    } catch (error: unknown) {
      logger.error("Error fetching  suggestedUsers", { error: (error as Error).message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }

  async follow(
    followerId: string,
    followingId: string
  ): Promise<{ followingCount: number }> {
    try {
      const result = await this._followsRepository.follow(
        followerId,
        followingId
      );

      // Update cache with write-through strategy
      await RedisCacheService.incrementFollowerCount(followingId);
      
      // Invalidate actor's caches immediately
      await RedisCacheService.invalidateUserCaches(followerId);
      
      // Queue suggestion invalidation for followers of the target user
      // Their suggestions might change since someone they follow gained a follower
      const impactedUserIds = await this._followsRepository.getFollowerIds(followingId);
      if (impactedUserIds.length > 0) {
        await RedisCacheService.queueSuggestionInvalidation(impactedUserIds);
      }

      const dedupeId = uuid();
      const version = await this._followsRepository.getVersion(
        followerId,
        followingId
      );

      const event = {
        followerId,
        followingId,
        version,
        timestamp: new Date().toISOString(),
        source: "auth-service",
      };

      // Publish with retry logic and compensation handling
      await publishEvent(KAFKA_TOPICS.USER_FOLLOWED, event, dedupeId);

      logger.info(`Follow operation completed successfully`, {
        followerId,
        followingId,
        followingCount: result.followingCount,
        dedupeId,
      });

      return result;
    } catch (error: unknown) {
      logger.error("Error in follow operation", {
        error: (error as Error).message,
        followerId,
        followingId,
      });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    try {
      const result = await this._followsRepository.unfollow(
        followerId,
        followingId
      );

      // Update cache with write-through strategy
      await RedisCacheService.decrementFollowerCount(followingId);
      
      // Invalidate actor's caches immediately
      await RedisCacheService.invalidateUserCaches(followerId)
      
      // Queue suggestion invalidation for followers of the target user
      // Their suggestions might change since someone they follow lost a follower
      const impactedUserIds = await this._followsRepository.getFollowerIds(followingId);
      if (impactedUserIds.length > 0) {
        await RedisCacheService.queueSuggestionInvalidation(impactedUserIds);
      }

      const dedupeId = uuid();

      const version = await this._followsRepository.getVersion(
        followerId,
        followingId
      );

      const event = {
        followerId,
        followingId,
        version,
        timestamp: new Date().toISOString(),
        source: "auth-service",
      };

      // Publish with retry logic and compensation handling
      await publishEvent(KAFKA_TOPICS.USER_UNFOLLOWED, event, dedupeId);

      return result;
    } catch (error: unknown) {
      logger.error("Error unfollowing user", { error: (error as Error).message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }
}
