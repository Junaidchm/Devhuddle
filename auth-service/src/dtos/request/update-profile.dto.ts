import { IsOptional, IsString, MinLength, MaxLength, IsArray, IsNumber, Min } from 'class-validator';

/**
 * Request DTO for updating user profile
 * Used for HTTP request validation
 */
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
