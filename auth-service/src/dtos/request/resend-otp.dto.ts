import { IsEmail } from 'class-validator';

/**
 * Request DTO for resending OTP
 * Used for HTTP request validation
 */
export class ResendOtpDto {
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;
}
