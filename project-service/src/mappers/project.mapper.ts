import { Project, Prisma } from '@prisma/client';
import { ProjectResponseDto } from '../dtos/response/project.dto';
import { CreateProjectDto, UpdateProjectDto } from '../dtos/request/project.dto';

/**
 * Mapper class for Project entity transformations
 */
export class ProjectMapper {
  /**
   * Map Prisma Project entity to ProjectResponseDto
   */
  static toResponseDto(entity: Project, likeCount?: number, viewCount?: number): ProjectResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      title: entity.title,
      description: entity.description,
      repositoryUrls: entity.repositoryUrls as string[] || undefined,
      demoUrl: entity.demoUrl || undefined,
      techStack: entity.techStack as string[] || undefined,
      tags: entity.tags as string[] || undefined,
      visibility: entity.visibility,
      // Note: Projects use ProjectMedia relation, not direct mediaIds array
      mediaIds: undefined,
      likeCount,
      viewCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  /**
   * Map CreateProjectDto to Prisma Project create input
   */
  static toCreateInput(dto: CreateProjectDto, userId: string): Prisma.ProjectCreateInput {
    return {
      userId,
      title: dto.title,
      description: dto.description,
      repositoryUrls: dto.repositoryUrls || [],
      demoUrl: dto.demoUrl,
      techStack: dto.techStack || [],
      tags: dto.tags || [],
      visibility: dto.visibility || 'PUBLIC'
      // Note: mediaIds are handled via ProjectMedia relation, not direct field
    };
  }

  /**
   * Map UpdateProjectDto to Prisma Project update input
   */
  static toUpdateInput(dto: UpdateProjectDto): Prisma.ProjectUpdateInput {
    const updateData: Prisma.ProjectUpdateInput = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.repositoryUrls !== undefined) updateData.repositoryUrls = dto.repositoryUrls;
    if (dto.demoUrl !== undefined) updateData.demoUrl = dto.demoUrl;
    if (dto.techStack !== undefined) updateData.techStack = dto.techStack;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.visibility !== undefined) updateData.visibility = dto.visibility;
    // Note: mediaIds updates handled via ProjectMedia relation

    return updateData;
  }

  /**
   * Map multiple Project entities to response DTOs
   */
  static toResponseDtoList(entities: Project[]): ProjectResponseDto[] {
    return entities.map(entity => this.toResponseDto(entity));
  }
}
