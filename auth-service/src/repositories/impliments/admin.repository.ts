import { prisma } from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { BaseRepository } from "../base.repository";
import { Prisma, User } from "@prisma/client";

export class AdminRepository extends BaseRepository<
  typeof prisma.user,
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput,
  Prisma.UserWhereUniqueInput
> {
  constructor() {
    super(prisma.user);
  }

  async findManyPaginated(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    date?: string
  ): Promise<{ users: Partial<User>[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const where: any = {
        NOT: { role: "superAdmin" },
      };

      if (status && status !== "all") {
        if (status === "active") where.isBlocked = false;
        else if (status === "inactive") {
          where.isBlocked = true;
        }
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
        ];
      }

      if (date && date !== "all") {
        const now = new Date();
        const fromDate = new Date();

        if (date === "today") {
          fromDate.setHours(0, 0, 0, 0);
        } else if (date === "last-week") {
          fromDate.setDate(now.getDate() - 7);
        } else if (date === "last-month") {
          fromDate.setDate(now.getDate() - 30);
        } else if (date === "last-quarter") {
          fromDate.setDate(now.getDate() - 90);
        }

        where.createdAt = { gte: fromDate };
      }

      const [users, total] = await Promise.all([
        this.model.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          where,
          select: {
            bio: true,
            company: true,
            createdAt: true,
            email: true,
            id: true,
            isBlocked: true,
            jobTitle: true,
            location: true,
            name: true,
            role: true,
            profilePicture: true,
            skills: true,
            yearsOfExperience: true,
            username: true,
            emailVerified: true,
          },
        }),
        this.model.count({ where }),
      ]);
      return { users, total };
    } catch (error) {
      logger.error("Error fetching paginated users", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async findUserFullDetails(userId: string): Promise<Partial<User> | null> {
    try {
      const user = await this.model.findUnique({
        where: { id: userId },
        select: {
          bio: true,
          company: true,
          createdAt: true,
          email: true,
          id: true,
          isBlocked: true,
          jobTitle: true,
          location: true,
          name: true,
          role: true,
          profilePicture: true,
          skills: true,
          yearsOfExperience: true,
          username: true,
          emailVerified: true,
        },
      });

      return user;
    } catch (error: any) {
      logger.error("Error fetching user full details", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async toogleUserBlock(
    userId: string
  ): Promise<{ id: string; isBlocked: boolean }> {
    try {
      const user = await super.findById(userId);
      const updatedUser = await this.model.update({
        where: { id: userId },
        data: { isBlocked: !user?.isBlocked },
        select: {
          id: true,
          isBlocked: true,
        },
      });
      return updatedUser;
    } catch (error: any) {
      logger.error("Error Toogling Block Unblock users", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
