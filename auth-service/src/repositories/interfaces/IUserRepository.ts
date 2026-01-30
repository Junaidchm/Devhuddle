import { User } from "../../types/auth";

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByIdUser(id: string): Promise<User | null>;
  createUser(
    email: string,
    username: string,
    name: string,
    password: string
  ): Promise<User>;
  verifyPassword(userPassword: string, password: string): Promise<boolean>;
  updateEmailVerified(email: string, emailVerified: boolean): Promise<User>;
  createOAuthUser(oauthUser: {
    email: string;
    username: string;
    name: string;
  }): Promise<User>;
  updatePassword(email: string, password: string): Promise<User>;
  updateProfile(userId: string, data: Partial<User>): Promise<User>;
  searchUsers(query: string, currentUserId: string): Promise<Partial<User>[]>;
  findProfileByUsername(
    username: string,
    currentUserId: string
  ): Promise<any | null>;
  findFollowers(userId: string, currentUserId: string): Promise<any[]>;
  findFollowing(userId: string, currentUserId: string): Promise<any[]>;
  addExperience(userId: string, data: any): Promise<any>;
  deleteExperience(id: string): Promise<void>;
  addEducation(userId: string, data: any): Promise<any>;
  deleteEducation(id: string): Promise<void>;
}