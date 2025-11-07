import { User } from "@prisma/client";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constents/httpStatus";
import { IUserService } from "../interface/IUserService";
import { IFollowsService } from "../interface/IFollowsService";
import { IUserRepository } from "../../repositories/interfaces/IUserRepository";

export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private followsService: IFollowsService
  ) {}

  async getProfileByUsername(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>> {
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
}

