/**
 * Response DTO for a conversation
 * Pure interface without validation decorators
 */
export interface ConversationResponseDto {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

/**
 * Response DTO for participant in conversation
 */
export interface ParticipantDto {
  userId: string;
  username: string;
  name: string;
  profilePhoto: string | null;
}

/**
 * Response DTO for conversation with full metadata
 * Includes participant info, last message, and unread count
 */
export interface ConversationWithMetadataDto {
  conversationId: string;
  participantIds: string[];
  participants: ParticipantDto[];
  lastMessage: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: Date;
  } | null;
  lastMessageAt: Date;
  unreadCount: number;
}

/**
 * Response DTO for conversation existence check
 */
export interface ConversationExistsResponseDto {
  exists: boolean;
  conversationId?: string;
}
