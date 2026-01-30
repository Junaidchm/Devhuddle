import { User } from "@prisma/client";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constents/httpStatus";
import { IUserService } from "../interface/IUserService";
import { IFollowsService } from "../interface/IFollowsService";
import { IUserRepository } from "../../repositories/interfaces/IUserRepository";
import { ChatSuggestionDto } from "../../dtos/response/chat-suggestion.dto";
import { UserMapper } from "../../mappers/user.mapper";
import { chatStatsClient } from "../../clients/chat-stats.client";
import { getCachedChatSuggestions, cacheChatSuggestions } from "../../utils/redis.util";
import logger from "../../utils/logger.util";

export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private followsService: IFollowsService
  ) {}

  async getProfileByUsername(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>> {
    // Profile pages require authentication (social media app - no public profiles)
    if (!currentUserId) {
      throw new CustomError(HttpStatus.UNAUTHORIZED, "Authentication required to view profiles");
    }
    
    const profile = await this.userRepository.findProfileByUsername(
      username,
      currentUserId
    );
    if (!profile) {
      throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
    }
    return profile;
  }

  async getFollowers(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>[]> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
    }
    return this.userRepository.findFollowers(user.id, currentUserId);
  }

  async getFollowing(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>[]> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
    }
    return this.userRepository.findFollowing(user.id, currentUserId);
  }

  async followUser(followerId: string, followingId: string): Promise<any> {
    return this.followsService.follow(followerId, followingId);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    return this.followsService.unfollow(followerId, followingId);
  }

  async searchUsers(query: string, currentUserId: string): Promise<Partial<User>[]> {
    return this.userRepository.searchUsers(query, currentUserId);
  }

  async getUserById(userId: string): Promise<Partial<User> | null> {
    return this.userRepository.findByIdUser(userId);
  }

  /**
   * Get chat suggestions with LinkedIn-style scoring
   * Uses Redis caching (5 min TTL) and gRPC to chat-service
   */
  async getChatSuggestions(
    userId: string,
    limit: number = 20
  ): Promise<ChatSuggestionDto[]> {
    try {
      logger.info(`📊 Getting chat suggestions for user: ${userId}`, { limit });

      // 1. Check Redis cache first (5 min TTL)
      const cached = await getCachedChatSuggestions<ChatSuggestionDto[]>(userId, limit);

      if (cached) {
        logger.info(`✅ Found cached suggestions`);
        return cached;
      }

      // 2. Get user's connections
      const connections = await this.userRepository.findFollowing(userId, userId);

      if (!connections || connections.length === 0) {
        return [];
      }

      // 3. Extract partner IDs
      const partnerIds = connections.map((c) => c.id);

      // 4. Fetch chat interaction stats from chat-service (via gRPC)
      // Note: This matches the previous logic, assuming chatStatsClient is available
      const chatStats = await chatStatsClient.getChatStats(userId, partnerIds, 30);

      // 5. Calculate scores for each connection
      const scored = connections.map((user) => {
        const stats = chatStats.get(user.id);
        let score = 0;

        if (stats) {
          // Factor 1: Message Frequency (40% weight) - max 40 points
          score += Math.min(40, stats.messageCount * 2);

          // Factor 2: Recent Activity (30% weight)
          if (stats.daysSinceLastMessage <= 1) score += 30; // Chatted today
          else if (stats.daysSinceLastMessage <= 7) score += 20; // Last week
          else if (stats.daysSinceLastMessage <= 30) score += 10; // Last month

          // Factor 3: Response Rate (20% weight)
          score += stats.responseRate * 20;

          // Factor 4: Balanced Conversation (10% weight)
          if (stats.userSentCount > 0 && stats.partnerSentCount > 0) {
            const balance =
              Math.min(stats.userSentCount, stats.partnerSentCount) /
              Math.max(stats.userSentCount, stats.partnerSentCount);
            score += balance * 10;
          }
        }

        // Factor 5: Profile Completeness (5% for users with no chat history)
        let completeness = 0;
        if (user.profilePicture) completeness += 2; // corrected property name
        if (user.bio) completeness += 2;
        if (user.skills && user.skills.length > 0) completeness += 1;
        score += completeness;

        return {
          user,
          score,
          hasHistory: !!stats,
        };
      });

      // 6. Sort by score (highest first)
      scored.sort((a, b) => b.score - a.score);

      // 7. Return top N as DTOs using UserMapper
      const suggestions = scored.slice(0, limit).map((item) => 
        UserMapper.toChatSuggestionDto(item.user as User)
      );

      // 8. Cache results (5 min TTL)
      await cacheChatSuggestions(userId, limit, suggestions, 300);

      return suggestions;
    } catch (error) {
      logger.error('❌ Failed to get chat suggestions', {
        error: (error as Error).message,
      });
      // Fallback: Return alphabetically sorted connections
      return this.getFallbackSuggestions(userId, limit);
    }
  }

  /**
   * Fallback if gRPC or scoring fails - simple alphabetical list
   */
  private async getFallbackSuggestions(
    userId: string,
    limit: number
  ): Promise<ChatSuggestionDto[]> {
    logger.warn('⚠️ Using fallback suggestions (alphabetical)');

    try {
      const connections = await this.userRepository.findFollowing(userId, userId);

      return connections
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .slice(0, limit)
        .map((user) => UserMapper.toChatSuggestionDto(user as User));
    } catch (error) {
      logger.error('❌ Fallback also failed', { error: (error as Error).message });
      return [];
    }
  }

  async addExperience(userId: string, data: any): Promise<any> {
    try {
      return await this.userRepository.addExperience(userId, data);
    } catch (error) {
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).message);
    }
  }

  async deleteExperience(userId: string, experienceId: string): Promise<void> {
    try {
      await this.userRepository.deleteExperience(experienceId);
    } catch (error) {
       throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).message);
    }
  }

  async addEducation(userId: string, data: any): Promise<any> {
    try {
      return await this.userRepository.addEducation(userId, data);
    } catch (error) {
       throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).message);
    }
  }

  async deleteEducation(userId: string, educationId: string): Promise<void> {
    try {
      await this.userRepository.deleteEducation(educationId);
    } catch (error) {
       throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).message);
    }
  }

  async updateSkills(userId: string, skills: string[]): Promise<void> {
    try {
       await this.userRepository.updateProfile(userId, { skills });
    } catch (error) {
       throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).message);
    }
  }
}
