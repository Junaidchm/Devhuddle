import { User } from '@prisma/client';
import { RegisterDto } from '../dtos/request/register.dto';
import { Prisma } from '@prisma/client';

/**
 * Mapper class for Authentication operations
 * Handles conversions for registration and login flows
 */
export class AuthMapper {
  /**
   * Map RegisterDto to Prisma UserCreateInput
   * Note: Password hashing should be done before calling this
   */
  static toCreateInput(dto: RegisterDto, hashedPassword: string): Prisma.UserCreateInput {
    return {
      name: dto.name,
      username: dto.username,
      email: dto.email,
      password: hashedPassword
    };
  }

  /**
   * Extract user data for JWT token payload
   */
  static toTokenPayload(user: User): {
    userId: string;
    email: string;
    username: string;
    name: string;
  } {
    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      name: user.name
    };
  }
}
