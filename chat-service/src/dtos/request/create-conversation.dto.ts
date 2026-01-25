import { IsArray, IsString, ArrayMinSize } from 'class-validator';

/**
 * Request DTO for creating a new conversation
 * Used for HTTP request validation
 */
export class CreateConversationDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one participant is required' })
  participantIds!: string[];
}
