import { IsString, MinLength } from 'class-validator';

/**
 * Request DTO for resetting password
 * Used for HTTP request validation
 */
export class ResetPasswordDto {
  @IsString({ message: "Token is required" })
  token!: string;

  @IsString({ message: "New password must be a string" })
  @MinLength(6, { message: "New password must be at least 6 characters long" })
  newPassword!: string;
}
