import { IsArray, IsString, ArrayMinSize } from 'class-validator';

/**
 * Request DTO for checking if conversation exists between users
 * Used for HTTP request validation
 */
export class CheckConversationDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one participant is required' })
  participantIds!: string[];
}
