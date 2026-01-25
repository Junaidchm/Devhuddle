import { NotificationRecipient } from '@prisma/client';
import { NotificationResponseDto } from '../dtos/response/notification.dto';

/**
 * Mapper class for Notification entity transformations
 */
export class NotificationMapper {
  /**
   * Map Prisma NotificationRecipient entity to NotificationResponseDto
   * Note: NotificationRecipient is a join table with minimal fields
   * To get full notification details, need to join with NotificationObject
   */
  static toResponseDto(entity: NotificationRecipient): NotificationResponseDto {
    return {
      id: entity.id,
      recipientId: entity.recipientId,
      // Note: NotificationRecipient doesn't have type/actorId directly
      // These come from the related NotificationObject
      type: '', // Placeholder - should be populated from NotificationObject relation
      actorId: undefined,
      postId: undefined,
      commentId: undefined,
      message: undefined,
      isRead: entity.read, // Schema uses 'read' not 'isRead'
      createdAt: entity.createdAt,
      updatedAt: entity.createdAt // Schema doesn't have updatedAt, use createdAt
    };
  }

  /**
   * Map multiple NotificationRecipient entities to response DTOs
   */
  static toResponseDtoList(entities: NotificationRecipient[]): NotificationResponseDto[] {
    return entities.map(entity => this.toResponseDto(entity));
  }
}
