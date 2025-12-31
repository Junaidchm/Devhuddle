import { prisma } from "../../config/prisma.config";
import { Media, MediaStatus, Prisma } from "@prisma/client";
import {
  IMediaRepository,
  CreateMediaData,
  UpdateMediaData,
} from "../interfaces/IMediaRepository";
import logger from "../../utils/logger.util";

export class MediaRepository implements IMediaRepository {
  async create(data: CreateMediaData): Promise<Media> {
    try {
      const media = await prisma.media.create({
        data: {
          userId: data.userId,
          mediaType: data.mediaType,
          storageKey: data.storageKey,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          uploadId: data.uploadId,
          status: "PENDING",
        },
      });

      logger.info("Media record created", { mediaId: media.id, userId: data.userId });
      return media;
    } catch (error: unknown) {
      logger.error("Failed to create media record", {
        error: (error as Error).message,
        data,
      });
      throw error;
    }
  }

  async findById(id: string): Promise<Media | null> {
    try {
      return await prisma.media.findUnique({
        where: { id },
      });
    } catch (error: unknown) {
      logger.error("Failed to find media by ID", {
        error: (error as Error).message,
        id,
      });
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Media[]> {
    try {
      return await prisma.media.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });
    } catch (error: unknown) {
      logger.error("Failed to find media by user ID", {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  async findByPostId(postId: string): Promise<Media[]> {
    try {
      return await prisma.media.findMany({
        where: { postId },
        orderBy: { createdAt: "asc" },
      });
    } catch (error: unknown) {
      logger.error("Failed to find media by post ID", {
        error: (error as Error).message,
        postId,
      });
      throw error;
    }
  }

  async findUnusedMedia(olderThanHours: number = 24): Promise<Partial<Media>[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

      return await prisma.media.findMany({
        where: {
          postId: null,
          status: {
            in: ["UPLOADED", "READY"],
          },
          createdAt: {
            lte: cutoffDate,
          },
        },
        select: {
          id: true,
          storageKey: true,
          thumbnailUrls: true,
          transcodedUrls: true,
        },
      });
    } catch (error: unknown) {
      logger.error("Failed to find unused media", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async update(id: string, data: UpdateMediaData): Promise<Media> {
    try {
      const media = await prisma.media.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      logger.info("Media record updated", { mediaId: id, updates: Object.keys(data) });
      return media;
    } catch (error: unknown) {
      logger.error("Failed to update media record", {
        error: (error as Error).message,
        id,
        data,
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.media.delete({
        where: { id },
      });
      logger.info("Media record deleted", { mediaId: id });
    } catch (error: unknown) {
      logger.error("Failed to delete media record", {
        error: (error as Error).message,
        id,
      });
      throw error;
    }
  }

  async deleteMany(ids: string[]): Promise<number> {
    try {
      const result = await prisma.media.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
      logger.info("Media records deleted", { count: result.count });
      return result.count;
    } catch (error: unknown) {
      logger.error("Failed to delete media records", {
        error: (error as Error).message,
        count: ids.length,
      });
      throw error;
    }
  }

  async updateStatus(id: string, status: MediaStatus): Promise<Media> {
    try {
      return await this.update(id, { status });
    } catch (error: unknown) {
      logger.error("Failed to update media status", {
        error: (error as Error).message,
        id,
        status,
      });
      throw error;
    }
  }
}

