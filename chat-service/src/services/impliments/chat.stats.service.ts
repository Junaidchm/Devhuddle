import { IChatStatsService, ChatInteractionStats } from "../interfaces/IChatStatsService";
import { IChatInteractionRepository } from "../../repositories/interfaces/IChatInteractionRepository";
import { GetChatStatsDto, GetRecentChatPartnersDto } from "../../dtos/chat-stats.dto";
import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import logger from "../../utils/logger.util";

export class ChatStatsService implements IChatStatsService {
  constructor(
    private _chatInteractionRepository: IChatInteractionRepository
  ) {}

  /**
   * Get chat statistics for suggestion scoring
   * Validates input and applies business logic
   */
  async getChatStats(
    userId: string,
    partnerIds: string[],
    daysBack: number = 30
  ): Promise<ChatInteractionStats[]> {
    try {
      // Validate input using DTO
      const dto = plainToClass(GetChatStatsDto, {
        userId,
        partnerIds,
        daysBack,
      });

      const errors = await validate(dto);
      if (errors.length > 0) {
        logger.error("Validation failed for getChatStats", { errors });
        throw new Error("Invalid input parameters");
      }

      logger.info("Getting chat stats", { userId, partnerCount: partnerIds.length, daysBack });

      if (!userId || !partnerIds || partnerIds.length === 0) {
        return [];
      }

      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - daysBack);

      // Get interactions from repository
      const interactions = await this._chatInteractionRepository.findByUserAndPartners(
        userId,
        partnerIds,
        sinceDate
      );

      logger.info("Found interactions", { count: interactions.length });

      // Calculate days since last message (business logic)
      const now = Date.now();
      return interactions.map((int) => ({
        partnerId: int.partnerId,
        lastMessageAt: int.lastMessageAt,
        messageCount: int.messageCount,
        userSentCount: int.userSentCount,
        partnerSentCount: int.partnerSentCount,
        responseRate: parseFloat(int.responseRate?.toString() || "0"),
        daysSinceLastMessage: Math.floor(
          (now - int.lastMessageAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));
    } catch (error) {
      logger.error("Failed to get chat stats", { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get recent chat partners (fast lookup)
   * Validates input using DTO
   */
  async getRecentChatPartners(
    userId: string,
    limit: number = 10,
    daysBack: number = 7
  ): Promise<string[]> {
    try {
      // Validate input using DTO
      const dto = plainToClass(GetRecentChatPartnersDto, {
        userId,
        limit,
        daysBack,
      });

      const errors = await validate(dto);
      if (errors.length > 0) {
        logger.error("Validation failed for getRecentChatPartners", { errors });
        throw new Error("Invalid input parameters");
      }

      logger.info("Getting recent partners", { userId, limit, daysBack });

      if (!userId) {
        return [];
      }

      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - daysBack);

      const interactions = await this._chatInteractionRepository.findRecentPartners(
        userId,
        limit,
        sinceDate
      );

      logger.info("Found recent partners", { count: interactions.length });

      return interactions.map((i) => i.partnerId);
    } catch (error) {
      logger.error("Failed to get recent partners", { error: (error as Error).message });
      throw error;
    }
  }
}

