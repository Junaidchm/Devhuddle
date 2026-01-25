import { IsEmail, IsString } from 'class-validator';

/**
 * Request DTO for user login
 * Used for HTTP request validation
 */
export class LoginDto {
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsString({ message: "Password must be a string" })
  password!: string;
}
