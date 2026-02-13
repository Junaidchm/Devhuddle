import { IsString, IsEnum, IsInt, Min, IsArray, ArrayMinSize, IsNotEmpty } from 'class-validator';

export enum MediaType {
  POST_IMAGE = 'POST_IMAGE',
  POST_VIDEO = 'POST_VIDEO',
  PROFILE_IMAGE = 'PROFILE_IMAGE',
  CHAT_IMAGE = 'CHAT_IMAGE',
  CHAT_VIDEO = 'CHAT_VIDEO',
  CHAT_AUDIO = 'CHAT_AUDIO',
  CHAT_FILE = 'CHAT_FILE',
}

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

  @IsEnum(MediaType, { message: "Valid MediaType is required (IMAGE or VIDEO)" })
  mediaType!: MediaType;
}

export class ValidateMediaDto {
  @IsArray()
  @ArrayMinSize(1, { message: "MediaIds array is required" })
  @IsString({ each: true })
  mediaIds!: string[];

  @IsString()
  @IsNotEmpty({ message: "UserId is required" })
  userId!: string;
}

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
