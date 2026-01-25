import { IsString, IsArray, IsNumber, IsOptional, IsInt, Min, Max, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTO for getting chat statistics
 * Used for LinkedIn-style suggestion scoring
 */
export class GetChatStatsDto {
  @IsString()
  userId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  partnerIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  daysBack?: number = 30;
}

/**
 * Request DTO for getting recent chat partners
 */
export class GetRecentChatPartnersDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  @Type(() => Number)
  daysBack?: number = 7;
}
