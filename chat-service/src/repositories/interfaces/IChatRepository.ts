import { Message, Conversation, Prisma, Participant } from "@prisma/client";

export interface IChatRepository {
  // Create a new message in a conversation
  createMessage(data: Prisma.MessageCreateInput): Promise<Message>;

  // Get messages from a conversation (paginated)
  getMessagesByConversationId(
    conversationId: string,
    limit: number,
    offset: number
  ): Promise<Message[]>;


  // Find a conversation by ID (with participants)
  findConversationById(conversationId: string): Promise<(Conversation & { participants: Participant[] }) | null>;

  // Find existing conversation between users, or create new one
  findOrCreateConversation(participantIds: string[]): Promise<Conversation>;

  // Update the lastMessageAt timestamp when a new message is sent
  updateLastMessageAt(conversationId: string, timestamp: Date): Promise<void>;

  // Get all conversations for a user
  getUserConversations(userId: string): Promise<Conversation[]>;

  // Get conversations with metadata (last message, unread count)
    getUserConversationsWithMetadata(
    userId: string,
    limit: number,
    offset: number
  ): Promise<ConversationWithMetadata[]>;

    // Message status update methods
    updateMessage(messageId: string, data: Prisma.MessageUpdateInput): Promise<Message>;
    findMessageById(messageId: string): Promise<Message | null>;
    markMessagesAsReadBefore(
        conversationId: string,
        excludeUserId: string,
        beforeTimestamp: Date
    ): Promise<void>;
    updateParticipantLastReadAt(
        conversationId: string,
        userId: string,
        timestamp: Date
    ): Promise<void>;

  // Check if conversation exists between users (no creation)
  conversationExists(participantIds: string[]): Promise<Conversation | null>;

  // Get last message for a conversation
  getLastMessage(conversationId: string): Promise<Message | null>;
}

/**
 * Type definition for conversation with metadata
 */
export interface ConversationWithMetadata extends Conversation {
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
}