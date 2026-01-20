import { IsArray, IsString, IsOptional, IsInt, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for creating a new conversation
 */
export class CreateConversationDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one participant is required' })
  participantIds!: string[];
}

/**
 * DTO for fetching messages with pagination
 */
export class GetMessagesDto {
  @IsOptional()
  @Type(() => Number)  
  @IsInt()
  @Min(1, { message: 'Limit must be at least 1' })
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)  
  @IsInt()
  @Min(0, { message: 'Offset cannot be negative' })
  offset?: number = 0;
}

/**
 * DTO for checking if conversation exists between users
 */
export class CheckConversationDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one participant is required' })
  participantIds!: string[];
}

