import { Message, Conversation, Prisma, } from "@prisma/client";

export interface IChatRepository {
  // Create a new message in a conversation
  createMessage(data: Prisma.MessageCreateInput): Promise<Message>;

  // Get messages from a conversation (paginated)
  getMessagesByConversationId(
    conversationId: string,
    limit: number,
    offset: number
  ): Promise<Message[]>;


  // Find a conversation by ID
  findConversationById(conversationId: string): Promise<Conversation | null>;

  // Find existing conversation between users, or create new one
  findOrCreateConversation(participantIds: string[]): Promise<Conversation>;

  // Update the lastMessageAt timestamp when a new message is sent
  updateLastMessageAt(conversationId: string, timestamp: Date): Promise<void>;

  // Get all conversations for a user
  getUserConversations(userId: string): Promise<Conversation[]>;
}