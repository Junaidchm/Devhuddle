import { IIdempotencyRepository } from "../interface/IIdempotencyRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import {
  IdempotencyKey,
  Prisma,
  IdempotencyStatus,
  HttpMethod,
} from "@prisma/client";
import logger from "../../utils/logger.util";

export class IdempotencyRepository
  extends BaseRepository<
    typeof prisma.idempotencyKey,
    IdempotencyKey,
    Prisma.IdempotencyKeyCreateInput,
    Prisma.IdempotencyKeyUpdateInput,
    Prisma.IdempotencyKeyWhereUniqueInput
  >
  implements IIdempotencyRepository
{
  constructor() {
    super(prisma.idempotencyKey);
  }

  async createIdempotencyKey(data: {
    key: string;
    userId: string;
    method: HttpMethod;
    route: string;
    requestHash?: string;
  }): Promise<IdempotencyKey> {
    try {
      return await super.create({
        ...data,
        method: data.method as HttpMethod,
      });
    } catch (error: unknown) {
      logger.error("Error creating idempotency key", {
        error: (error as Error).message,
      });
      throw new Error("Failed to create idempotency key");
    }
  }

  async findIdempotencyKey(key: string): Promise<IdempotencyKey | null> {
    try {
      return await prisma.idempotencyKey.findUnique({ where: { key } });
    } catch (error: unknown) {
      logger.error("Error finding idempotency key", { error: (error as Error).message });
      throw new Error("Failed to find idempotency key");
    }
  }

  async updateIdempotencyKey(
    key: string,
    data: {
      status: IdempotencyStatus;
      response?: Prisma.InputJsonValue;
      requestHash?: string;
    }
  ): Promise<IdempotencyKey> {
    try {
      return await super.updateWhere({ key } as Prisma.IdempotencyKeyWhereUniqueInput, data);
    } catch (error: unknown) {
      logger.error("Error updating idempotency key", {
        error: (error as Error).message,
      });
      throw new Error("Failed to update idempotency key");
    }
  }

  async deleteIdempotencyKey(key: string): Promise<void> {
    try {
      await prisma.idempotencyKey.delete({ where: { key } });
    } catch (error: unknown) {
      logger.error("Error deleting idempotency key", { error: (error as Error).message });
      throw new Error("Failed to delete idempotency key");
    }
  }
}

