import { User } from "@prisma/client";

export interface IAdminService {
  getUsers(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    date?: string
  ): Promise<{ users: Partial<User>[]; total: number }>;

  getUserFullDetails(userId: string): Promise<Partial<User> | null>;

  toogleUserState(userId: string): Promise<void>;
}