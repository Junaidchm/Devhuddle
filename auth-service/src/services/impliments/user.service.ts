import { User } from "@prisma/client";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constents/httpStatus";
import { IUserService } from "../interface/IUserService";
import { IFollowsService } from "../interface/IFollowsService";
import { IUserRepository } from "../../repositories/interfaces/IUserRepository";
import { ChatSuggestionUserDto } from "../../dtos/auth.dto";

export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private followsService: IFollowsService
  ) {}

  async getProfileByUsername(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>> {
    // Profile pages require authentication (social media app - no public profiles)
    if (!currentUserId) {
      throw new CustomError(HttpStatus.UNAUTHORIZED, "Authentication required to view profiles");
    }
    
    const profile = await this.userRepository.findProfileByUsername(
      username,
      currentUserId
    );
    if (!profile) {
      throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
    }
    return profile;
  }

  async getFollowers(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>[]> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
    }
    return this.userRepository.findFollowers(user.id, currentUserId);
  }

  async getFollowing(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>[]> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
    }
    return this.userRepository.findFollowing(user.id, currentUserId);
  }

  async followUser(followerId: string, followingId: string): Promise<any> {
    return this.followsService.follow(followerId, followingId);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    return this.followsService.unfollow(followerId, followingId);
  }

  async searchUsers(query: string, currentUserId: string): Promise<Partial<User>[]> {
    return this.userRepository.searchUsers(query, currentUserId);
  }

  async getUserById(userId: string): Promise<Partial<User> | null> {
    return this.userRepository.findByIdUser(userId);
  }

  /**
   * Get chat suggestions for a user
   * Returns user's existing connections with profile data (LinkedIn-style)
   */
  
  async getChatSuggestions(userId: string, limit: number = 20): Promise<ChatSuggestionUserDto[]> {
    try {
      // 1. Get user's connections (people they follow)
      const connections = await this.userRepository.findFollowing(userId, userId);
      
      if (!connections || connections.length === 0) {
        return [];
      }

      // 2. Map connections to chat suggestions format
      const suggestions: ChatSuggestionUserDto[] = connections.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName || user.name || user.username,
        profilePhoto: user.profilePhoto || undefined,
        bio: user.bio || undefined,
        skills: user.skills || [],
      }));

      // 3. Sort alphabetically by full name (LinkedIn-style)
      const sorted = suggestions.sort((a, b) => 
        a.fullName.localeCompare(b.fullName)
      );

      // 4. Return top N results
      return sorted.slice(0, limit);
    } catch (error) {
      // Log error but don't throw - graceful degradation
      console.error('Failed to get chat suggestions:', error);
      return [];
    }
  }
}

