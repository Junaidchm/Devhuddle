import { IsString, IsEnum, IsOptional } from 'class-validator';

/**
 * Request DTO for generating presigned URLs for S3
 * Used for HTTP request validation
 */
export class GeneratePresignedUrlDto {
  @IsString()
  fileName!: string;

  @IsString()
  fileType!: string;

  @IsEnum(['PUT', 'GET'], { message: "Operation must be either PUT or GET" })
  operation!: 'PUT' | 'GET';

  @IsOptional()
  @IsString()
  key?: string;
}
