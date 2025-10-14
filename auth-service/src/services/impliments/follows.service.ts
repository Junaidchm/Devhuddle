import { error } from "console";
import { IFollowsRepository } from "../../repositories/interfaces/IFollowsRepository";
import { SuggestedUser } from "../../types/auth";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import redisClient from "../../utils/redis.util";
import { IFollowsService } from "../interface/IFollowsService";
import { v4 as uuid } from "uuid";
import { publishEvent } from "../../utils/kafka.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";

export class FollowsService implements IFollowsService {
  constructor(private _followsRepository: IFollowsRepository) {}

  async getSuggestions(
    userId: string,
    limit: number = 5
  ): Promise<{ suggestedUsers: SuggestedUser[]; error?: string }> {
    try {
      const suggestedUsers =
        await this._followsRepository.getSuggestionsForUser(userId, limit);

      return { suggestedUsers };
    } catch (error: any) {
      logger.error("Error fetching  suggestedUsers", { error: error.message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }

  async follow(followerId: string, followingId: string): Promise<void> {
    try {
      await this._followsRepository.follow(followerId, followingId);

      // Cache update
      // const countKey = `user:followers:count:${followingId}`;
      // await redisClient.incr(countKey);
      // await redisClient.del(`suggestions:${followerId}:*`);

      const dedupeId = uuid();
      const version = await this._followsRepository.getVersion(
        followerId,
        followingId
      );
      publishEvent(
        KAFKA_TOPICS.USER_FOLLOWED,
        { followerId, followingId, version },
        dedupeId
      ).catch((error) => logger.error("Saga publish failed:", error));
    } catch (error: any) {
      logger.error("Error fetching  suggestedUsers", { error: error.message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    try {
      await this._followsRepository.unfollow(followerId, followingId);

      // Redis cache update
      // const countKey = `user:followers:count:${followingId}`;
      // await redisClient.decrby(countKey, 1);
      // await redisClient.del(`suggestions:${followerId}:*`);

      const dedupeId = uuid();
      const version = this._followsRepository.getVersion(
        followerId,
        followingId
      );
      publishEvent(
        KAFKA_TOPICS.USER_UNFOLLOWED,
        { followerId, followingId, version },
        dedupeId
      ).catch();
    } catch (error: any) {
      logger.error("Error fetching  suggestedUsers", { error: error.message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }
}
