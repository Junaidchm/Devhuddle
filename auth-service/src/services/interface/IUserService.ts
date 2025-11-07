import { User } from "@prisma/client";

export interface IUserService {
  getProfileByUsername(
    username: string,
    currentUserId: string
  ): Promise<Partial<User> | null>;
  getFollowers(username: string, currentUserId: string): Promise<Partial<User>[]>;
  getFollowing(username: string, currentUserId: string): Promise<Partial<User>[]>;
}

