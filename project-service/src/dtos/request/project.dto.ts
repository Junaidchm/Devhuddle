import { IsString, IsNotEmpty, IsEnum, IsArray, IsOptional, IsUrl } from 'class-validator';

export enum ProjectVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  VISIBILITY_CONNECTIONS = 'VISIBILITY_CONNECTIONS',
}

export enum ReportReason {
  SPAM = 'SPAM',
  INAPPROPRIATE = 'INAPPROPRIATE',
  HARASSMENT = 'HARASSMENT',
  COPYRIGHT = 'COPYRIGHT',
  MISLEADING = 'MISLEADING',
  OTHER = 'OTHER',
}

/**
 * Request DTO for creating a project
 */
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: "Title is required" })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: "Description is required" })
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  repositoryUrls?: string[];

  @IsOptional()
  @IsString()
  @IsUrl()
  demoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ProjectVisibility)
  visibility?: ProjectVisibility;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];
}

/**
 * Request DTO for updating a project
 */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  repositoryUrls?: string[];

  @IsOptional()
  @IsString()
  @IsUrl()
  demoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ProjectVisibility)
  visibility?: ProjectVisibility;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];
}

/**
 * Request DTO for reporting a project
 */
export class ReportProjectDto {
  @IsEnum(ReportReason, { message: "Valid report reason is required" })
  reason!: ReportReason;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
