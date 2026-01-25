import { IsEmail } from 'class-validator';

/**
 * Request DTO for requesting password reset
 * Used for HTTP request validation
 */
export class RequestPasswordResetDto {
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;
}
