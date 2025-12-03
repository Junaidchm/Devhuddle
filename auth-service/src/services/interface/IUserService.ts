import { User } from "@prisma/client";

export interface IUserService {
  getProfileByUsername(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>>;
  getFollowers(username: string, currentUserId: string): Promise<Partial<User>[]>;
  getFollowing(username: string, currentUserId: string): Promise<Partial<User>[]>;
  searchUsers(query: string, currentUserId: string): Promise<Partial<User>[]>;
  getUserById(userId: string): Promise<Partial<User> | null>;
}

