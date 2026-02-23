import { Message, Conversation, Participant, Prisma } from '@prisma/client';
import { MessageResponseDto } from '../dtos/response/message.dto';
import { ConversationResponseDto, ConversationWithMetadataDto, ParticipantDto } from '../dtos/response/conversation.dto';

/**
 * Mapper class for Message entity transformations
 */
export class MessageMapper {
  /**
   * Map SendMessageCommand to Prisma message create input
   */
  static toPersistence(command: import('../dtos/chat-service.dto').SendMessageCommand, conversationId: string): Prisma.MessageCreateInput {
    return {
      conversation: {
        connect: { id: conversationId }
      },
      senderId: command.senderId,
      content: command.content,
      type: command.messageType, // ✅ FIX: Prisma field is 'type', not 'messageType'
      status: 'SENT',
      mediaUrl: command.mediaUrl || null,
      mediaId: command.mediaId || null,
      mediaMimeType: command.mediaMimeType || null,
      mediaSize: command.mediaSize || null,
      mediaName: command.mediaName || null,
      mediaDuration: command.mediaDuration || null,
      replyTo: command.replyToId ? { connect: { id: command.replyToId } } : undefined,
      dedupeId: command.dedupeId || null,
      // Forwarding fields
      isForwarded: command.isForwarded,
      forwardedFrom: command.forwardedFrom || null,
      originalMessageId: command.originalMessageId || null
    };
  }

  /**
   * Map Prisma Message entity to MessageResponseDto
   */
  static toResponseDto(entity: Message): MessageResponseDto {
    return {
      id: entity.id,
      conversationId: entity.conversationId,
      senderId: entity.senderId,
      content: entity.content,
      createdAt: entity.createdAt,
      // Note: Message model doesn't have updatedAt in schema
      updatedAt: entity.createdAt, // Use createdAt as fallback
      
      status: entity.status as 'SENT' | 'DELIVERED' | 'READ',
      deliveredAt: entity.deliveredAt,
      readAt: entity.readAt,
      dedupeId: entity.dedupeId || undefined,
      
      // Forwarding fields
      isForwarded: entity.isForwarded,
      forwardedFrom: entity.forwardedFrom || undefined,
      originalMessageId: entity.originalMessageId || undefined,

      // Map replyTo relation if it exists (requires 'include' in repo)
      replyTo: (entity as any).replyTo ? {
        id: (entity as any).replyTo.id,
        content: (entity as any).replyTo.content,
        senderId: (entity as any).replyTo.senderId,
        // senderName would require user profile lookup, can be done in service or left for client to resolve
      } : null,

      // Map reactions
      reactions: (entity as any).reactions ? (entity as any).reactions.map((r: any) => ({
        id: r.id,
        emoji: r.emoji,
        userId: r.userId
      })) : [],

      // Map media fields
      type: entity.type as any,
      mediaUrl: entity.mediaUrl,
      mediaId: entity.mediaId,
      mediaMimeType: entity.mediaMimeType,
      mediaSize: entity.mediaSize,
      mediaName: entity.mediaName,
      mediaDuration: entity.mediaDuration
    };
  }

  /**
   * Map multiple Message entities to response DTOs
   */
  static toResponseDtoList(entities: Message[]): MessageResponseDto[] {
    return entities.map(entity => this.toResponseDto(entity));
  }
}

/**
 * Mapper class for Conversation entity transformations
 */
export class ConversationMapper {
  /**
   * Map Prisma Conversation entity to ConversationResponseDto
   */
  static toResponseDto(entity: Conversation): ConversationResponseDto {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lastMessageAt: entity.lastMessageAt
    };
  }

  /**
   * Map Conversation with participants to ConversationWithMetadataDto
   * Note: This requires user profile data from auth-service via gRPC
   */
  static toMetadataDto(
    conversation: Conversation & { participants: Participant[] },
    userProfilesMap: Map<string, { username: string; name: string; profilePhoto: string | null }>,
    lastMessage?: { content: string; senderId: string; createdAt: Date } | null,
    unreadCount: number = 0
  ): ConversationWithMetadataDto {
    const participantIds = conversation.participants.map(p => p.userId);
    
    return {
      conversationId: conversation.id,
      participantIds,
      participants: conversation.participants.map(p => {
        const profile = userProfilesMap.get(p.userId);
        return {
          userId: p.userId,
          username: profile?.username || 'unknown',
          name: profile?.name || 'Unknown User',
          profilePhoto: profile?.profilePhoto || null
        };
      }),
      lastMessage: lastMessage ? {
        content: lastMessage.content,
        senderId: lastMessage.senderId,
        senderName: userProfilesMap.get(lastMessage.senderId)?.name || 'Unknown',
        createdAt: lastMessage.createdAt
      } : null,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount
    };
  }

  /**
   * Map multiple conversations to response DTOs
   */
  static toResponseDtoList(entities: Conversation[]): ConversationResponseDto[] {
    return entities.map(entity => this.toResponseDto(entity));
  }
}
