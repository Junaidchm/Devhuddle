import { IProjectShareRepository, CreateProjectShareData } from "../interface/IProjectShareRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { ProjectShare, Prisma } from "@prisma/client";
import logger from "../../utils/logger.util";

export class ProjectShareRepository
  extends BaseRepository<
    typeof prisma.projectShare,
    ProjectShare,
    Prisma.ProjectShareCreateInput,
    Prisma.ProjectShareUpdateInput,
    Prisma.ProjectShareWhereUniqueInput
  >
  implements IProjectShareRepository
{
  constructor() {
    super(prisma.projectShare);
  }

  async createShare(data: CreateProjectShareData): Promise<ProjectShare> {
    try {
      const share = await super.create({
        Project: { connect: { id: data.projectId } },
        userId: data.userId,
        shareType: data.shareType || "SHARE",
        caption: data.caption,
      });

      // Increment project shares count
      await prisma.project.update({
        where: { id: data.projectId },
        data: {
          sharesCount: { increment: 1 },
        },
      });

      return share;
    } catch (error: any) {
      logger.error("Error creating project share", { error: error.message });
      throw new Error("Failed to create share");
    }
  }

  async findShare(projectId: string, userId: string): Promise<ProjectShare | null> {
    try {
      return await super.findOne({ projectId, userId } as any);
    } catch (error: any) {
      logger.error("Error finding project share", { error: error.message });
      throw new Error("Failed to find share");
    }
  }

  async getSharesByProject(projectId: string, limit: number = 20): Promise<ProjectShare[]> {
    try {
      return await prisma.projectShare.findMany({
        where: { projectId },
        take: limit,
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting shares by project", { error: error.message });
      throw new Error("Failed to get shares by project");
    }
  }

  async getShareCount(projectId: string): Promise<number> {
    try {
      return await prisma.projectShare.count({ where: { projectId } });
    } catch (error: any) {
      logger.error("Error getting project share count", { error: error.message });
      throw new Error("Failed to get share count");
    }
  }

  async hasShared(projectId: string, userId: string): Promise<boolean> {
    try {
      const share = await this.findShare(projectId, userId);
      return !!share;
    } catch (error: any) {
      logger.error("Error checking if user shared project", { error: error.message });
      return false;
    }
  }

  async getUserSharesForProjects(
    userId: string,
    projectIds: string[]
  ): Promise<Record<string, boolean>> {
    try {
      if (!userId || projectIds.length === 0) {
        return {};
      }

      const shares = await prisma.projectShare.findMany({
        where: {
          userId,
          projectId: {
            in: projectIds,
          },
        },
        select: {
          projectId: true,
        },
      });

      return shares.reduce<Record<string, boolean>>((acc, share) => {
        acc[share.projectId] = true;
        return acc;
      }, {});
    } catch (error: any) {
      logger.error("Error getting user shares for projects", {
        error: error.message,
        userId,
        projectIdsCount: projectIds.length,
      });
      throw new Error("Database error");
    }
  }
}

