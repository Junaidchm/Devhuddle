import { IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTO for chat suggestion query parameters
 * Used for HTTP request validation
 */
export class GetChatSuggestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}
