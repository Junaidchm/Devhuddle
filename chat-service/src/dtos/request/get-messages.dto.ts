import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTO for fetching messages with pagination
 * Used for HTTP request validation
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
