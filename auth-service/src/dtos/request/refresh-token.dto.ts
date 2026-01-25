import { IsOptional, IsString } from 'class-validator';

/**
 * Request DTO for refreshing access token
 * Used for HTTP request validation
 */
export class RefreshTokenDto {
  @IsOptional() // Handled via cookie usually, but sometimes body
  @IsString()
  refreshToken?: string;
}
