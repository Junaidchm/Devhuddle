import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.util";

export abstract class BaseRepository<T> {
  protected prisma: PrismaClient;
  protected model: any;

  constructor(prisma: PrismaClient, model: any) {
    this.prisma = prisma;
    this.model = model;
  }

  async findById(id: string): Promise<T | null> {
    try {
      return await this.model.findUnique({ where: { id } });
    } catch (error: any) {
      logger.error(`Error finding entity by id: ${id}`, {
        error: error.message,
      });
      throw new Error("Database error");
    }
  }

  async findOne(where: Partial<T>): Promise<T | null> {
    try {
      return await this.model.findFirst({ where });
    } catch (error: any) {
      logger.error("Error finding entity", { error: error.message });
      throw new Error("Database error");
    }
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      return await this.model.create({ data });
    } catch (error: any) {
      logger.error("Error creating entity", { error: error.message });
      throw new Error("Database error");
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      return await this.model.update({ where: { id }, data });
    } catch (error: any) {
      logger.error(`Error updating entity: ${id}`, { error: error.message });
      throw new Error("Database error");
    }
  }

  async delete(id: string) {
    try {
      await this.model.delete({ where: { id } });
    } catch (error: any) {
      logger.error(`Error deleting entity: ${id}`, { error: error.message });
      throw new Error("Database error");
    }
  }

  async updateWhere(where: Partial<T>, data: Partial<T>): Promise<T> {
    try {
      return await this.model.update({ where, data });
    } catch (error: any) {
      logger.error('Error updating entity by criteria', { error: error.message });
      throw new Error('Database error');
    }
  }
}
