import { User } from "@prisma/client";
import { IAdminRepository } from "../../repositories/interfaces/IAdminRepository";
import logger from "../../utils/logger.util";
import { CustomError } from "../../utils/error.util";
import { setUsertoBlockBlackList } from "../../utils/redis.actions";
import { IAdminService } from "../interface/IadminService";

export class AdminService implements IAdminService {
  constructor(private _adminRepository: IAdminRepository) {}

  async getUsers(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    date?: string
  ): Promise<{ users: Partial<User>[]; total: number }> {
    try {
      if (page < 1 || limit < 1) {
        logger.error("Invalid page or limit parameters", { page, limit });
        throw new CustomError(400, "Invalid page or limit");
      }
      return await this._adminRepository.findManyPaginated(
        page,
        limit,
        status,
        search,
        date
      );
    } catch (error: unknown) {
      logger.error("Error fetching users", { error: (error as Error).message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }

  async getUserFullDetails(userId: string): Promise<Partial<User> | null> {
    try {
      const user = await this._adminRepository.findUserFullDetails(userId);
      if (!user) {
        logger.error(`user not found for this id : ${userId}`);
        throw new CustomError(404, "user Not found");
      }

      return user;
    } catch (error: unknown) {
      logger.error("Error fetching users", { error: (error as Error).message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  } 

  async toogleUserState(userId: string): Promise<void> {
    try {
      const user = await this._adminRepository.findById(userId);
      if (!user) {
        logger.error(`User not found: ${userId}`);
        throw new CustomError(404, "User not found");
      }

      const updatedUser = await this._adminRepository.toogleUserBlock(userId);
      await setUsertoBlockBlackList(updatedUser.id,updatedUser.isBlocked)

    } catch (error: unknown) {
      logger.error(`Error Toogling user: ${userId}`, { error: (error as Error).message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }
}
