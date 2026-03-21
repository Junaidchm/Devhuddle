import { Message, Conversation, Prisma, Participant, BlockedUser, Report as PrismaReport } from "@prisma/client";

export interface IChatRepository {
  // Create a new message in a conversation
  createMessage(data: Prisma.MessageCreateInput): Promise<Message>;

  // Get messages from a conversation (paginated)
  // Get messages from a conversation (paginated with offset)
    getMessagesByConversationId(
    conversationId: string,
    userId: string,
    limit: number,
    offset: number,
    before?: Date
  ): Promise<Message[]>;

  // Get messages filtered by type (Media, Docs, etc.)
  getMessagesByType(
    conversationId: string,
    userId: string,
    types: string[],
    limit: number,
    offset: number
  ): Promise<Message[]>;


  // Find a conversation by ID (with participants)
  
  findConversationById(conversationId: string): Promise<(Conversation & { participants: Participant[] }) | null>;

  // Find existing conversation between users, or create new one
  findOrCreateConversation(participantIds: string[]): Promise<Conversation & { participants: Participant[] }>;

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
    updateMessage(messageId: string, data: Prisma.MessageUpdateInput): Promise<Message>;
    findMessageById(messageId: string): Promise<Message | null>;
    findMessageWithContext(messageId: string): Promise<(Message & { conversation: Conversation & { participants: Participant[] } }) | null>;
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

    // Message Receipt Management
    createMessageReceipts(messageId: string, userIds: string[]): Promise<void>;
    updateMessageReceipt(messageId: string, userId: string, status: 'DELIVERED' | 'READ'): Promise<void>;
    aggregateMessageStatus(messageId: string): Promise<Message>;

  // Check if conversation exists between users (no creation)
  conversationExists(participantIds: string[]): Promise<Conversation | null>;

  // Get last message for a conversation
  getLastMessage(conversationId: string): Promise<Message | null>;

  // Group Management Methods
    createGroupConversation(
        creatorId: string, 
        name: string, 
        participantIds: string[], 
        icon?: string,
        onlyAdminsCanPost?: boolean,
        onlyAdminsCanEditInfo?: boolean,
        topics?: string[]
    ): Promise<Conversation & { participants: Participant[] }>;

    findAllGroups(
        query?: string,
        topics?: string[],
        limit?: number,
        offset?: number
    ): Promise<(Conversation & { participants: Participant[] })[]>;
    findMyGroups(
        userId: string,
        query?: string,
        limit?: number,
        offset?: number
    ): Promise<(Conversation & { participants: Participant[] })[]>;
    findDiscoverGroups(
        userId: string,
        query?: string,
        topics?: string[],
        limit?: number,
        offset?: number
    ): Promise<(Conversation & { participants: Participant[] })[]>;
    getPopularTopics(limit?: number): Promise<{ topic: string, count: number }[]>;
  addParticipantToGroup(groupId: string, userId: string, role?: 'ADMIN' | 'MEMBER'): Promise<void>;
  /** 
   * Idempotent method to ensure a participant is active in a group.
   * Handles re-activation of previously deleted participants.
   * Returns whether the participant was ALREADY active.
   */
  ensureParticipantActive(groupId: string, userId: string, role?: 'ADMIN' | 'MEMBER'): Promise<{ wasAlreadyActive: boolean }>;
  removeParticipantFromGroup(groupId: string, userId: string): Promise<void>;
  updateParticipantRole(groupId: string, userId: string, role: 'ADMIN' | 'MEMBER'): Promise<void>;
  updateGroupMetadata(
    groupId: string, 
    data: { 
      name?: string; 
      description?: string; 
      icon?: string;
      onlyAdminsCanPost?: boolean;
      onlyAdminsCanEditInfo?: boolean;
    }
  ): Promise<Conversation>;
  findParticipantInConversation(userId: string, conversationId: string): Promise<Participant | null>;
  deleteConversation(conversationId: string): Promise<void>;
  
  // Soft Delete & History
  softDeleteConversation(conversationId: string, userId: string): Promise<void>;
  clearChatHistory(conversationId: string, userId: string): Promise<void>;
  
  // Common Groups
  getCommonGroups(userId1: string, userId2: string): Promise<Conversation[]>;
  
  // Search messages in a conversation
  searchMessages(conversationId: string, userId: string, query: string): Promise<Message[]>;

  // Links
  saveMessageLinks(messageId: string, urls: string[]): Promise<void>;
  getConversationLinks(conversationId: string, limit: number, offset: number): Promise<any[]>;

  // Message Actions
  editMessage(messageId: string, content: string): Promise<Message>;
  deleteMessage(messageId: string): Promise<void>;
  deleteMessageForMe(messageId: string, userId: string): Promise<void>;
  
  // Reactions
  addReaction(messageId: string, userId: string, emoji: string): Promise<void>;
  removeReaction(messageId: string, userId: string, emoji: string): Promise<void>;
  getReactions(messageId: string): Promise<any[]>; // Type as needed
  getUserReactionOnMessage(messageId: string, userId: string): Promise<any | null>;

  // Pins
  pinMessage(messageId: string, userId: string): Promise<Message>;
  unpinMessage(messageId: string): Promise<Message>;
  getPinnedMessages(conversationId: string, userId: string): Promise<Message[]>;

  // Blocking
  blockUser(blockerId: string, blockedId: string): Promise<void>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  getBlockedUsers(userId: string): Promise<BlockedUser[]>;
  isUserBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  getBlockRelationships(userId: string): Promise<{ blockedByMe: string[], blockedMe: string[] }>;
  /** Delete previous block/unblock SYSTEM messages for a conversation before adding a new one */
  deleteBlockSystemMessages(conversationId: string): Promise<void>;

  // Reporting
  createReport(data: Prisma.ReportCreateInput): Promise<PrismaReport>;
  getReportsByConversationId(conversationId: string): Promise<PrismaReport[]>;
  findReportById(reportId: string): Promise<PrismaReport | null>;
  getConversationCount(where?: Prisma.ConversationWhereInput): Promise<number>;
  updateConversation(conversationId: string, data: Prisma.ConversationUpdateInput): Promise<Conversation>;
  findHubsWithReportCount(
    where: Prisma.ConversationWhereInput,
    limit?: number,
    offset?: number
  ): Promise<(Conversation & { participants: Participant[]; _count: { reports: number } })[]>;
  findHubByIdWithReportCount(
    hubId: string
  ): Promise<(Conversation & { participants: Participant[]; _count: { reports: number } }) | null>;
  /** Update member count atomically (+1 or -1) and return the new count */
    updateMemberCount(conversationId: string, delta: number): Promise<number>;
    syncAllMemberCounts(): Promise<void>;
}

/**
 * Type definition for conversation with metadata
 */
export interface ConversationWithMetadata extends Conversation {
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
}
