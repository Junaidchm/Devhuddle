import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import logger from '../utils/logger.util';

const PROTO_PATH = path.join(__dirname, '../../protos/chat-stats.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const chatStatsService = protoDescriptor.chatstats.ChatStatsService;

// gRPC Response Types (matches proto definition)
interface GrpcChatInteraction {
  partner_id: string;
  last_message_at: string;
  message_count: number;
  user_sent_count: number;
  partner_sent_count: number;
  response_rate: number;
  days_since_last_message: number;
}

interface GrpcGetChatStatsResponse {
  interactions: GrpcChatInteraction[];
}

interface GrpcGetRecentPartnersResponse {
  partner_ids: string[];
}

// Application Domain Types
export interface ChatInteraction {
  partnerId: string;
  lastMessageAt: Date;
  messageCount: number;
  userSentCount: number;
  partnerSentCount: number;
  responseRate: number;
  daysSinceLastMessage: number;
}

export class ChatStatsClient {
  private _client: any;
  private readonly _maxRetries = 3;
  private readonly _timeout = 5000; // 5 seconds

  constructor() {
    const CHAT_SERVICE_GRPC_URL =
      process.env.CHAT_SERVICE_GRPC_URL || 'localhost:50051';

    logger.info('🔌 Connecting to Chat Service gRPC', { url: CHAT_SERVICE_GRPC_URL });

    this._client = new chatStatsService(
      CHAT_SERVICE_GRPC_URL,
      grpc.credentials.createInsecure()
    );
  }

  /**
   * Get chat statistics for scoring suggestions
   * Returns a Map for O(1) lookups during scoring
   */
  async getChatStats(
    userId: string,
    partnerIds: string[],
    daysBack: number = 30
  ): Promise<Map<string, ChatInteraction>> {
    if (!userId || !partnerIds || partnerIds.length === 0) {
      logger.warn('getChatStats: Invalid parameters', { userId, partnerCount: partnerIds?.length });
      return new Map();
    }

    return new Promise((resolve) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this._timeout / 1000);

      logger.info('📊 Calling gRPC getChatStats', { 
        userId, 
        partnerCount: partnerIds.length,
        daysBack 
      });

      this._client.getChatStats(
        {
          user_id: userId,
          partner_ids: partnerIds,
          days_back: daysBack,
        },
        { deadline },
        (error: grpc.ServiceError | null, response: GrpcGetChatStatsResponse) => {
          if (error) {
            logger.error('❌ gRPC getChatStats error', { 
              message: error.message,
              code: error.code 
            });
            // Graceful degradation - return empty map
            return resolve(new Map());
          }

          const statsMap = new Map<string, ChatInteraction>();

          response.interactions?.forEach((int: GrpcChatInteraction) => {
            statsMap.set(int.partner_id, {
              partnerId: int.partner_id,
              lastMessageAt: new Date(int.last_message_at),
              messageCount: int.message_count,
              userSentCount: int.user_sent_count,
              partnerSentCount: int.partner_sent_count,
              responseRate: int.response_rate,
              daysSinceLastMessage: int.days_since_last_message,
            });
          });

          logger.info(`✅ gRPC: Got stats for ${statsMap.size} users`);
          resolve(statsMap);
        }
      );
    });
  }

  /**
   * Get recent chat partners (fast lookup)
   * Useful for showing "Recently chatted with" section
   */
  async getRecentChatPartners(
    userId: string,
    limit: number = 10,
    daysBack: number = 7
  ): Promise<string[]> {
    if (!userId) {
      logger.warn('getRecentChatPartners: No userId provided');
      return [];
    }

    return new Promise((resolve) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this._timeout / 1000);

      logger.info('🔍 Calling gRPC getRecentChatPartners', { userId, limit, daysBack });

      this._client.getRecentChatPartners(
        {
          user_id: userId,
          limit,
          days_back: daysBack,
        },
        { deadline },
        (error: grpc.ServiceError | null, response: GrpcGetRecentPartnersResponse) => {
          if (error) {
            logger.error('❌ gRPC getRecentChatPartners error', { 
              message: error.message,
              code: error.code 
            });
            return resolve([]);
          }

          logger.info(`✅ gRPC: Got ${response.partner_ids?.length || 0} recent partners`);
          resolve(response.partner_ids || []);
        }
      );
    });
  }

  /**
   * Health check for gRPC connection
   * Can be called on startup to verify connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to get stats for a dummy user (will return empty, but tests connection)
      await this.getChatStats('health-check', ['dummy'], 1);
      logger.info('✅ Chat service gRPC health check passed');
      return true;
    } catch (error) {
      logger.error('❌ Chat service gRPC health check failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }
}

// Singleton instance
export const chatStatsClient = new ChatStatsClient();
