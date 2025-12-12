import { IsEmail, IsString, MinLength, IsOptional, MaxLength, IsArray, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

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

export class LoginDto {
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsString({ message: "Password must be a string" })
  password!: string;
}

export class VerifyOtpDto {
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsString({ message: "OTP must be a string" })
  @MinLength(4, { message: "OTP must be at least 4 characters long" })
  otp!: string;
}

export class ResendOtpDto {
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;
}

export class RequestPasswordResetDto {
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;
}

export class ResetPasswordDto {
  @IsString({ message: "Token is required" })
  token!: string;

  @IsString({ message: "New password must be a string" })
  @MinLength(6, { message: "New password must be at least 6 characters long" })
  newPassword!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsOfExperience?: number;
}

export class RefreshTokenDto {
  @IsOptional() // Handled via cookie usually, but sometimes body
  @IsString()
  refreshToken?: string;
}

export class GeneratePresignedUrlDto {
  @IsString()
  fileName!: string;

  @IsString()
  fileType!: string;

  @IsEnum(['PUT', 'GET'], { message: "Operation must be either PUT or GET" })
  operation!: 'PUT' | 'GET';

  @IsOptional()
  @IsString()
  key?: string;
}
