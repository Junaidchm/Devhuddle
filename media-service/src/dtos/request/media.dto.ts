import { IsString, IsNotEmpty, IsEnum, IsInt, Min, IsArray, ArrayMinSize } from 'class-validator';

export enum MediaType {
  POST_IMAGE = 'POST_IMAGE',
  POST_VIDEO = 'POST_VIDEO',
  PROFILE_IMAGE = 'PROFILE_IMAGE',
}

/**
 * Request DTO for creating upload session
 */
export class CreateUploadSessionDto {
  @IsString()
  @IsNotEmpty({ message: "FileName is required" })
  fileName!: string;

  @IsString()
  @IsNotEmpty({ message: "FileType is required" })
  fileType!: string;

  @IsInt()
  @Min(1, { message: "FileSize must be greater than 0" })
  fileSize!: number;

  @IsEnum(MediaType, { message: "Valid MediaType is required" })
  mediaType!: MediaType;
}

/**
 * Request DTO for validating media
 */
export class ValidateMediaDto {
  @IsArray()
  @ArrayMinSize(1, { message: "MediaIds array is required" })
  @IsString({ each: true })
  mediaIds!: string[];

  @IsString()
  @IsNotEmpty({ message: "UserId is required" })
  userId!: string;
}

/**
 * Request DTO for linking media to post
 */
export class LinkMediaToPostDto {
  @IsArray()
  @ArrayMinSize(1, { message: "MediaIds array is required" })
  @IsString({ each: true })
  mediaIds!: string[];

  @IsString()
  @IsNotEmpty({ message: "PostId is required" })
  postId!: string;

  @IsString()
  @IsNotEmpty({ message: "UserId is required" })
  userId!: string;
}
