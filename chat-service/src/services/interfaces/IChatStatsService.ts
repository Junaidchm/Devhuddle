export interface ChatInteractionStats {
  partnerId: string;
  lastMessageAt: Date;
  messageCount: number;
  userSentCount: number;
  partnerSentCount: number;
  responseRate: number;
  daysSinceLastMessage: number;
}

export interface IChatStatsService {
  getChatStats(
    userId: string,
    partnerIds: string[],
    daysBack: number
  ): Promise<ChatInteractionStats[]>;

  getRecentChatPartners(
    userId: string,
    limit: number,
    daysBack: number
  ): Promise<string[]>;
}
