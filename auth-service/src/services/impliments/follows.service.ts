import { IFollowsRepository } from "../../repositories/interfaces/IFollowsRepository";
import { SuggestedUser } from "../../types/auth";
import logger from "../../utils/logger.util";
import redisClient from "../../utils/redis.util";
import { IFollowsService } from "../interface/IFollowsService";

export class FollowsService implements IFollowsService {
  constructor(private _followsRepository: IFollowsRepository) {}

  async getSuggestions(userId: string, limit: number = 5): Promise<{ suggestedUsers: SuggestedUser[]; error?: string }> {
    // const cacheKey = `suggestions:${userId}:${limit}`;
    
    // let cached = await redisClient.get(cacheKey);
    // if (cached) {
    //   return { suggestedUsers: JSON.parse(cached) };
    // }

    try {
      const suggestedUsers = await this._followsRepository.getSuggestionsForUser(userId, limit);

      console.log('this is the suggestedUsers ---------------------------=======================>', suggestedUsers)

      // Cache miss: Store with TTL (10min, refresh on follow events via Kafka invalidation)
      // await redisClient.setEx(cacheKey, 600, JSON.stringify(suggestedUsers));

      return { suggestedUsers };
    } catch (error) {
      logger.error('Suggestion service error:', error);
      return { suggestedUsers: [], error: 'Failed to generate suggestions' };
    }
  }
  
}
