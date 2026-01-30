import { User } from "@prisma/client";

export interface IAdminRepository {
  findManyPaginated(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    date?: string
  ): Promise<{ users: Partial<User>[]; total: number }>;

  findUserFullDetails(userId: string): Promise<Partial<User> | null>;

  toogleUserBlock(userId: string): Promise<{ id: string; isBlocked: boolean }>;

  findById(id: string): Promise<User | null>;
}
