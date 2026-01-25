/**
 * Response DTO for chat interaction statistics
 */
export interface ChatInteractionStatsDto {
  partnerId: string;
  lastMessageAt: string;
  messageCount: number;
  userSentCount: number;
  partnerSentCount: number;
  responseRate: number;
  daysSinceLastMessage: number;
}

/**
 * Response DTO for chat statistics
 */
export interface GetChatStatsResponseDto {
  interactions: ChatInteractionStatsDto[];
}

/**
 * Response DTO for recent chat partners
 */
export interface GetRecentChatPartnersResponseDto {
  partnerIds: string[];
}
