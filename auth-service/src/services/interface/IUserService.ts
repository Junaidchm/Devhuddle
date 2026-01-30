import { User } from "@prisma/client";
import { ChatSuggestionUserDto } from "../../dtos/auth.dto";

export interface IUserService {
  getProfileByUsername(
    username: string,
    currentUserId: string
  ): Promise<Partial<User>>;
  getFollowers(username: string, currentUserId: string): Promise<Partial<User>[]>;
  getFollowing(username: string, currentUserId: string): Promise<Partial<User>[]>;
  searchUsers(query: string, currentUserId: string): Promise<Partial<User>[]>;
  getUserById(userId: string): Promise<Partial<User> | null>;
  getChatSuggestions(userId: string, limit: number): Promise<ChatSuggestionUserDto[]>
  addExperience(userId: string, data: any): Promise<any>;
  deleteExperience(userId: string, experienceId: string): Promise<void>;
  addEducation(userId: string, data: any): Promise<any>;
  deleteEducation(userId: string, educationId: string): Promise<void>;
  updateSkills(userId: string, skills: string[]): Promise<void>;
}