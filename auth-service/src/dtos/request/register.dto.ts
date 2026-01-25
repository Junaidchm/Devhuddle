import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Request DTO for user registration
 * Used for HTTP request validation
 */
export class RegisterDto {
  @IsString({ message: "Name must be a string" })
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  name!: string;

  @IsString({ message: "Username must be a string" })
  @MinLength(3, { message: "Username must be at least 3 characters long" })
  username!: string;

  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsString({ message: "Password must be a string" })
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  password!: string;
}
