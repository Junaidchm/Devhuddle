import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Request DTO for OTP verification
 * Used for HTTP request validation
 */
export class VerifyOtpDto {
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsString({ message: "OTP must be a string" })
  @MinLength(4, { message: "OTP must be at least 4 characters long" })
  otp!: string;
}
