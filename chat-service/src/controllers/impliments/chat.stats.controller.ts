import * as grpc from '@grpc/grpc-js';
import { IChatStatsService } from '../../services/interfaces/IChatStatsService';
import logger from '../../utils/logger.util';
import { GetChatStatsRequest, GetChatStatsResponse, GetRecentPartnersRequest, GetRecentPartnersResponse } from '../../types/chat.interaction';

export class ChatStatsController {
  constructor(private _chatStatsService: IChatStatsService) {}

  /**
   * gRPC handler: Get chat statistics
   */
  async getChatStats(
    call: grpc.ServerUnaryCall<GetChatStatsRequest, GetChatStatsResponse>,
    callback: grpc.sendUnaryData<GetChatStatsResponse>
  ): Promise<void> {
    try {
      const { user_id, partner_ids, days_back = 30 } = call.request;

      logger.info('gRPC getChatStats called', {
        user_id,
        partner_count: partner_ids?.length,
        days_back,
      });

      // Call service layer
      const stats = await this._chatStatsService.getChatStats(
        user_id,
        partner_ids,
        days_back
      );

      // Map to gRPC response format
      const response: GetChatStatsResponse = {
        interactions: stats.map((stat) => ({
          partner_id: stat.partnerId,
          last_message_at: stat.lastMessageAt.toISOString(),
          message_count: stat.messageCount,
          user_sent_count: stat.userSentCount,
          partner_sent_count: stat.partnerSentCount,
          response_rate: stat.responseRate,
          days_since_last_message: stat.daysSinceLastMessage,
        })),
      };

      callback(null, response);
    } catch (error) {
      logger.error('gRPC getChatStats error', { error: (error as Error).message });
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to get chat stats',
      });
    }
  }

  /**
   * gRPC handler: Get recent chat partners
   */
  async getRecentChatPartners(
    call: grpc.ServerUnaryCall<GetRecentPartnersRequest, GetRecentPartnersResponse>,
    callback: grpc.sendUnaryData<GetRecentPartnersResponse>
  ): Promise<void> {
    try {
      const { user_id, limit = 10, days_back = 7 } = call.request;

      logger.info('gRPC getRecentChatPartners called', { user_id, limit, days_back });

      // Call service layer
      const partnerIds = await this._chatStatsService.getRecentChatPartners(
        user_id,
        limit,
        days_back
      );

      callback(null, { partner_ids: partnerIds });
    } catch (error) {
      logger.error('gRPC getRecentChatPartners error', { error: (error as Error).message });
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to get recent partners',
      });
    }
  }
}
