import { IsString, IsEnum, IsArray, IsOptional, IsUrl, IsInt, Min, IsNotEmpty } from 'class-validator';

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

export class UploadProjectMediaDto {
  @IsString()
  @IsUrl()
  url!: string;

  @IsString()
  @IsNotEmpty()
  // Validating IMAGE or VIDEO as per controller logic
  // Could use IsEnum if we defined MediaType here, but controller uses string literals check
  type!: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  duration?: number;
}

export class ShareProjectDto {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  shareType?: string;
}

export class ReportProjectDto {
  @IsEnum(ReportReason, { message: "Valid report reason is required" })
  reason!: ReportReason;

  @IsOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
