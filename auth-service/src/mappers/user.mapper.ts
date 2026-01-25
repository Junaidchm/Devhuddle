import { User, Prisma } from '@prisma/client';
import { UserResponseDto } from '../dtos/response/user.dto';
import { ChatSuggestionDto } from '../dtos/response/chat-suggestion.dto';
import { AuthResponseDto, OtpVerificationResponseDto } from '../dtos/response/auth.dto';
import { UpdateProfileDto } from '../dtos/request/update-profile.dto';

/**
 * Mapper class for User entity transformations
 * Handles conversions between Prisma entities, DTOs, and gRPC messages
 */
export class UserMapper {
  /**
   * Map Prisma User entity to UserResponseDto
   */
  static toResponseDto(entity: User, followerCount?: number, followingCount?: number, isFollowing?: boolean): UserResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      username: entity.username,
      email: entity.email,
      fullName: entity.name, // Use name as fullName since DB doesn't have fullName field
      location: entity.location || undefined,
      bio: entity.bio || undefined,
      profilePicture: entity.profilePicture || undefined,
      skills: entity.skills || undefined,
      jobTitle: entity.jobTitle || undefined,
      company: entity.company || undefined,
      yearsOfExperience: entity.yearsOfExperience ? parseInt(entity.yearsOfExperience) : undefined, // DB stores as string
      followerCount,
      followingCount,
      isFollowing,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  /**
   * Map Prisma User entity to ChatSuggestionDto
   */
  static toChatSuggestionDto(entity: User): ChatSuggestionDto {
    return {
      id: entity.id,
      username: entity.username,
      fullName: entity.name, // Use name as fullName since DB doesn't have fullName field
      profilePhoto: entity.profilePicture || undefined,
      bio: entity.bio || undefined,
      skills: entity.skills || []
    };
  }

  /**
   * Map User entity to AuthResponseDto (for login/register)
   */
  static toAuthResponseDto(entity: User, accessToken: string, refreshToken: string, message?: string): AuthResponseDto {
    return {
      user: {
        id: entity.id,
        name: entity.name,
        username: entity.username,
        email: entity.email,
        profilePicture: entity.profilePicture || undefined
      },
      accessToken,
      refreshToken,
      message
    };
  }

  /**
   * Map User entity to OTP verification response
   */
  static toOtpVerificationResponseDto(
    entity: User, 
    accessToken: string, 
    refreshToken: string
  ): OtpVerificationResponseDto {
    return {
      success: true,
      message: 'OTP verified successfully',
      user: {
        id: entity.id,
        name: entity.name,
        username: entity.username,
        email: entity.email
      },
      accessToken,
      refreshToken
    };
  }

  /**
   * Map UpdateProfileDto to Prisma User update input
   */
  static toUpdateInput(dto: UpdateProfileDto): Prisma.UserUpdateInput {
    const updateData: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.profilePicture !== undefined) updateData.profilePicture = dto.profilePicture;
    if (dto.skills !== undefined) updateData.skills = dto.skills;
    if (dto.jobTitle !== undefined) updateData.jobTitle = dto.jobTitle;
    if (dto.company !== undefined) updateData.company = dto.company;
    if (dto.yearsOfExperience !== undefined) updateData.yearsOfExperience = dto.yearsOfExperience.toString(); // DB stores as string

    return updateData;
  }

  /**
   * Map User entity to gRPC UserProfile message
   */
  static toGrpcUserProfile(entity: User): {
    id: string;
    username: string;
    name: string;
    profilePhoto: string;
  } {
    return {
      id: entity.id,
      username: entity.username,
      name: entity.name,
      profilePhoto: entity.profilePicture || ''
    };
  }

  /**
   * Map User entity to gRPC getUserForFeedListingResponse
   */
  static toGrpcFeedListingResponse(entity: User): {
    avatar: string;
    name: string;
    username: string;
  } {
    return {
      avatar: entity.profilePicture || '',
      name: entity.name,
      username: entity.username
    };
  }

  /**
   * Map User entity to gRPC Follower message
   */
  static toGrpcFollower(entity: User): {
    id: string;
    username: string;
    name: string;
  } {
    return {
      id: entity.id,
      username: entity.username,
      name: entity.name
    };
  }
}
