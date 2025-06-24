import prisma from "../config/prisma.config";
import { Session } from "../generated/prisma";
import logger from "../utils/logger.util";
import { BaseRepository } from "./base.repository";

export interface ISessionRepository {
  createSession(userId: string, refreshToken: string): Promise<Session>;
  findByRefreshToken(refreshToken: string): Promise<Session | null>;
  deleteByRefreshToken(refreshToken: string): Promise<void>;
}

export class SessionRepository
  extends BaseRepository<Session>
  implements ISessionRepository
{
  constructor() {
    super(prisma, prisma.session);
  }

  async createSession(userId: string, refreshToken: string): Promise<Session> {
    try {
      const expiresAt: Date = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      return await super.create({ userId, refreshToken, expiresAt });
    } catch (error: any) {
      logger.error("Error creating session", { error: error.message });
      throw new Error("Database error");
    }
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    try {
      return await this.model.findFirst({ where: { refreshToken } });
    } catch (error: any) {
      logger.error("Error finding session", { error: error.message });
      throw new Error("Database error");
    }
  }

  async deleteByRefreshToken(refreshToken: string): Promise<void> {
    try {
      await this.model.deleteMany({ where: { refreshToken } });
    } catch (error: any) {
      logger.error("Error deleting session", { error: error.message });
      throw new Error("Database error");
    }
  }
}
