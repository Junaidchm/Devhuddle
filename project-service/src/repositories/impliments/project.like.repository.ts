import { IProjectLikeRepository, CreateProjectLikeData } from "../interface/IProjectLikeRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { ProjectLike, Prisma } from "@prisma/client";
import logger from "../../utils/logger.util";

export class ProjectLikeRepository
  extends BaseRepository<
    typeof prisma.projectLike,
    ProjectLike,
    Prisma.ProjectLikeCreateInput,
    Prisma.ProjectLikeUpdateInput,
    Prisma.ProjectLikeWhereUniqueInput
  >
  implements IProjectLikeRepository
{
  constructor() {
    super(prisma.projectLike);
  }

  async createLike(data: CreateProjectLikeData): Promise<ProjectLike> {
    try {
      // Check if soft-deleted like exists and restore it
      const softDeletedLike = await this.findSoftDeletedLike(data.projectId, data.userId);
      if (softDeletedLike) {
        return await this.restoreLike(softDeletedLike.id);
      }

      // Create new like
      const like = await prisma.projectLike.create({
        data: {
          projectId: data.projectId,
          userId: data.userId,
        },
      });

      // Increment project likes count
      await prisma.project.update({
        where: { id: data.projectId },
        data: {
          likesCount: { increment: 1 },
        },
      });

      return like;
    } catch (error: unknown) {
      logger.error("Error creating project like", {
        error: (error as Error).message,
        errorCode: (error as { code?: string }).code,
        data,
      });
      if ((error as { code?: string }).code === "P2002") {
        throw new Error("Like already exists");
      }
      throw new Error(`Database error: ${(error as Error).message}`);
    }
  }

  async deleteLike(projectId: string, userId: string): Promise<void> {
    try {
      const like = await prisma.projectLike.findFirst({
        where: {
          projectId,
          userId,
          deletedAt: null,
        },
      });

      if (!like) {
        throw new Error("Like not found");
      }

      await prisma.projectLike.update({
        where: { id: like.id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Decrement project likes count
      await prisma.project.update({
        where: { id: projectId },
        data: {
          likesCount: { decrement: 1 },
        },
      });
    } catch (error: unknown) {
      logger.error("Error deleting project like", {
        error: (error as Error).message,
        projectId,
        userId,
      });
      throw new Error("Database error");
    }
  }

  async findLike(projectId: string, userId: string): Promise<ProjectLike | null> {
    try {
      return await prisma.projectLike.findFirst({
        where: {
          projectId,
          userId,
          deletedAt: null,
        },
      });
    } catch (error: unknown) {
      logger.error("Error finding project like", {
        error: (error as Error).message,
        projectId,
        userId,
      });
      throw new Error("Database error");
    }
  }

  async findSoftDeletedLike(projectId: string, userId: string): Promise<ProjectLike | null> {
    try {
      return await prisma.projectLike.findFirst({
        where: {
          projectId,
          userId,
          deletedAt: { not: null },
        },
        orderBy: { deletedAt: "desc" },
      });
    } catch (error: unknown) {
      logger.error("Error finding soft-deleted project like", {
        error: (error as Error).message,
        projectId,
        userId,
      });
      throw new Error("Database error");
    }
  }

  async restoreLike(likeId: string): Promise<ProjectLike> {
    try {
      const like = await prisma.projectLike.findUnique({
        where: { id: likeId },
      });

      if (!like) {
        throw new Error("Like not found");
      }

      const restored = await prisma.projectLike.update({
        where: { id: likeId },
        data: {
          deletedAt: null,
          createdAt: new Date(),
        },
      });

      // Increment project likes count
      await prisma.project.update({
        where: { id: like.projectId },
        data: {
          likesCount: { increment: 1 },
        },
      });

      return restored;
    } catch (error: unknown) {
      logger.error("Error restoring project like", {
        error: (error as Error).message,
        likeId,
      });
      throw new Error("Database error");
    }
  }

  async getLikeCount(projectId: string): Promise<number> {
    try {
      return await prisma.projectLike.count({
        where: {
          projectId,
          deletedAt: null,
        },
      });
    } catch (error: unknown) {
      logger.error("Error getting project like count", {
        error: (error as Error).message,
        projectId,
      });
      throw new Error("Database error");
    }
  }

  async getUserLikesForProjects(
    userId: string,
    projectIds: string[]
  ): Promise<Record<string, boolean>> {
    try {
      if (!userId || projectIds.length === 0) {
        return {};
      }

      const likes = await prisma.projectLike.findMany({
        where: {
          userId,
          deletedAt: null,
          projectId: {
            in: projectIds,
          },
        },
        select: {
          projectId: true,
        },
      });

      return likes.reduce<Record<string, boolean>>((acc, like) => {
        acc[like.projectId] = true;
        return acc;
      }, {});
    } catch (error: unknown) {
      logger.error("Error getting user likes for projects", {
        error: (error as Error).message,
        userId,
        projectIdsCount: projectIds.length,
      });
      throw new Error("Database error");
    }
  }
}

