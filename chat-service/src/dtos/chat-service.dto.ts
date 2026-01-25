/**
 * Service Layer DTOs (Business DTOs / Commands)
 * These handle business logic validation, not HTTP validation
 */

/**
 * Command to send a message in a conversation
 */
export class SendMessageCommand {
  constructor(
    public readonly senderId: string,
    public readonly recipientIds: string[],
    public readonly content: string,
    // Media fields (optional)
    public readonly messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' = 'TEXT',
    public readonly mediaUrl?: string,
    public readonly mediaId?: string,
    public readonly mediaMimeType?: string,
    public readonly mediaSize?: number,
    public readonly mediaName?: string,
    public readonly mediaDuration?: number
  ) {
    if (!senderId) throw new Error("Sender ID is required");
    if (!recipientIds || recipientIds.length === 0) throw new Error("At least one recipient is required");
    // Content is optional for media messages, but we'll enforce at least one of content or mediaUrl
    if ((!content || content.trim().length === 0) && !mediaUrl) {
        throw new Error("Message must have content or media");
    }

    this.validate();
  }

  private validate(): void {
    // Business rule: Can't send message to yourself only
    if (this.recipientIds.length === 1 && this.recipientIds[0] === this.senderId) {
      throw new Error('Cannot send message to yourself only');
    }

    // Business rule: Message too long
    if (this.content && this.content.length > 5000) {
      throw new Error('Message content too long (max 5000 characters)');
    }

    // Business rule: Maximum recipients in group chat
    if (this.recipientIds.length > 50) {
      throw new Error('Too many recipients (max 50)');
    }
  }
}

/**
 * Command to create a conversation
 */
export class CreateConversationCommand {
  constructor(
    public readonly initiatorId: string,
    public readonly participantIds: string[]
  ) {
    this.validate();
  }

  private validate(): void {
    // Business rule: Need at least 2 participants (initiator + 1 other)
    if (this.participantIds.length < 1) {
      throw new Error('Need at least one other participant');
    }

    // Business rule: Maximum participants in conversation
    if (this.participantIds.length > 100) {
      throw new Error('Too many participants (max 100)');
    }

    // Business rule: Can't create conversation with yourself only
    const uniqueParticipants = new Set([this.initiatorId, ...this.participantIds]);
    if (uniqueParticipants.size < 2) {
      throw new Error('Need at least 2 unique participants');
    }

    // Business rule: No duplicate participants
    const hasDuplicates = this.participantIds.length !== new Set(this.participantIds).size;
    if (hasDuplicates) {
      throw new Error('Duplicate participant IDs not allowed');
    }
  }

  /**
   * Get all unique participant IDs including initiator
   */
  getAllParticipants(): string[] {
    return Array.from(new Set([this.initiatorId, ...this.participantIds]));
  }
}

/**
 * Query object for fetching messages
 */
export class GetMessagesQuery {
  constructor(
    public readonly conversationId: string,
    public readonly userId: string,
    public readonly limit: number,
    public readonly offset: number
  ) {
    this.validate();
  }

  private validate(): void {
    // Business rule: Limit must be reasonable
    if (this.limit < 1 || this.limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    // Business rule: Offset cannot be negative
    if (this.offset < 0) {
      throw new Error('Offset cannot be negative');
    }
  }
}

/**
 * Query object for getting user conversations
 */
export class GetUserConversationsQuery {
  constructor(
    public readonly userId: string
  ) {
    this.validate();
  }

  private validate(): void {
    // Business rule: User ID must be valid
    if (!this.userId || this.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
  }
}

/**
 * Query object for getting user conversations with metadata
 * Includes last message, unread counts, and participant info
 */
export class GetUserConversationsWithMetadataQuery {
  constructor(
    public readonly userId: string,
    public readonly limit: number,
    public readonly offset: number
  ) {
    this.validate();
  }

  private validate(): void {
    // Business rule: User ID must be valid
    if (!this.userId || this.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }

    // Business rule: Limit must be reasonable
    if (this.limit < 1 || this.limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    // Business rule: Offset cannot be negative
    if (this.offset < 0) {
      throw new Error('Offset cannot be negative');
    }
  }
}

/**
 * Query object for checking if conversation exists
 */
export class CheckConversationExistsQuery {
  constructor(
    public readonly currentUserId: string,
    public readonly participantIds: string[]
  ) {
    this.validate();
  }

  private validate(): void {
    // Business rule: Current user ID must be valid
    if (!this.currentUserId || this.currentUserId.trim().length === 0) {
      throw new Error('Current user ID is required');
    }

    // Business rule: Need at least one other participant
    if (!this.participantIds || this.participantIds.length < 1) {
      throw new Error('Need at least one other participant');
    }

    // Business rule: No duplicate participants
    const hasDuplicates = this.participantIds.length !== new Set(this.participantIds).size;
    if (hasDuplicates) {
      throw new Error('Duplicate participant IDs not allowed');
    }

    // Business rule: Can't check conversation with yourself
    if (this.participantIds.includes(this.currentUserId)) {
      throw new Error('Cannot include yourself in participant list');
    }
  }

  /**
   * Get all unique participant IDs including current user
   */
  getAllParticipants(): string[] {
    return Array.from(new Set([this.currentUserId, ...this.participantIds]));
  }
}

/**
 * Response DTO for conversation with metadata
 */
export interface ConversationWithMetadataDto {
  conversationId: string;
  participantIds: string[];
  participants: {
    userId: string;
    username: string;
    name: string;
    profilePhoto: string | null;
  }[];
  lastMessage: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: Date;
  } | null;
  lastMessageAt: Date;
  unreadCount: number;
}


