import { Message, Conversation, Participant, Prisma } from '@prisma/client';
import { MessageResponseDto } from '../dtos/response/message.dto';
import { ConversationResponseDto, ConversationWithMetadataDto, ParticipantDto } from '../dtos/response/conversation.dto';

/**
 * Mapper class for Message entity transformations
 */
export class MessageMapper {
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
      updatedAt: entity.createdAt // Use createdAt as fallback
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
