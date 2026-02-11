/**
 * Response DTO for a message reaction
 */
export interface MessageReactionResponseDto {
  id: string;
  emoji: string;
  userId: string;
  createdAt: Date;
}
