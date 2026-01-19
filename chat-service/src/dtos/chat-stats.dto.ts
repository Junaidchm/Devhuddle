import { IsString, IsArray, IsNumber, IsOptional, IsInt, Min, Max, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for getting chat statistics
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
 * DTO for getting recent chat partners
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

/**
 * Response DTO for chat interaction statistics
 */
export class ChatInteractionStatsDto {
  @IsString()
  partnerId!: string;

  @IsString()
  lastMessageAt!: string;

  @IsInt()
  messageCount!: number;

  @IsInt()
  userSentCount!: number;

  @IsInt()
  partnerSentCount!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  responseRate!: number;

  @IsInt()
  @Min(0)
  daysSinceLastMessage!: number;
}

/**
 * Response DTO for chat statistics
 */
export class GetChatStatsResponseDto {
  @IsArray()
  @Type(() => ChatInteractionStatsDto)
  interactions!: ChatInteractionStatsDto[];
}

/**
 * Response DTO for recent chat partners
 */
export class GetRecentChatPartnersResponseDto {
  @IsArray()
  @IsString({ each: true })
  partnerIds!: string[];
}
