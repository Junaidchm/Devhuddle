import { Media } from '@prisma/client';
import { MediaResponseDto } from '../dtos/response/media.dto';

/**
 * Mapper class for Media entity transformations
 */
export class MediaMapper {
  /**
   * Map Prisma Media entity to MediaResponseDto
   */
  static toResponseDto(entity: Media): MediaResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      fileName: entity.fileName,
      fileType: entity.mimeType, // Schema uses mimeType not fileType
      fileSize: Number(entity.fileSize), // Convert BigInt to number
      s3Key: entity.storageKey, // Schema uses storageKey not s3Key
      url: entity.cdnUrl || entity.originalUrl || '', // Use cdnUrl or originalUrl
      status: entity.status,
      mediaType: entity.mediaType,
      postId: entity.postId || undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  /**
   * Map multiple Media entities to response DTOs
   */
  static toResponseDtoList(entities: Media[]): MediaResponseDto[] {
    return entities.map(entity => this.toResponseDto(entity));
  }
}
