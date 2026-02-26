import { IProjectCommentRepository } from "../interface/IProjectCommentRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { ProjectComment, Prisma } from "@prisma/client";
import logger from "../../utils/logger.util";

export class ProjectCommentRepository
  extends BaseRepository<
    typeof prisma.projectComment,
    ProjectComment,
    Prisma.ProjectCommentCreateInput,
    Prisma.ProjectCommentUpdateInput,
    Prisma.ProjectCommentWhereUniqueInput
  >
  implements IProjectCommentRepository
{
  constructor() {
    super(prisma.projectComment);
  }

  async createComment(data: {
    projectId: string;
    userId: string;
    content: string;
    parentCommentId?: string;
  }): Promise<ProjectComment> {
    try {
      return await prisma.projectComment.create({
        data: {
          content: data.content,
          userId: data.userId,
          projectId: data.projectId,
          parentCommentId: data.parentCommentId,
        },
      });
    } catch (error: unknown) {
      logger.error("Error in createComment repository", { error });
      throw error;
    }
  }

  async updateComment(
    commentId: string,
    data: Partial<Prisma.ProjectCommentUpdateInput>
  ): Promise<ProjectComment> {
    try {
      return await prisma.projectComment.update({
        where: { id: commentId },
        data,
      });
    } catch (error: unknown) {
      logger.error("Error in updateComment repository", { error });
      throw error;
    }
  }

  async deleteComment(commentId: string): Promise<void> {
    try {
      await prisma.projectComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });
    } catch (error: unknown) {
      logger.error("Error in deleteComment repository", { error });
      throw error;
    }
  }

  async findComment(commentId: string): Promise<ProjectComment | null> {
    try {
      return await prisma.projectComment.findUnique({
        where: { id: commentId, deletedAt: null },
      });
    } catch (error: unknown) {
      logger.error("Error in findComment repository", { error });
      throw error;
    }
  }

  async getCommentsByProject(
    projectId: string,
    limit: number,
    offset: number,
    includeReplies: boolean = true
  ): Promise<ProjectComment[]> {
    try {
      return await prisma.projectComment.findMany({
        where: {
          projectId,
          parentCommentId: null,
          deletedAt: null,
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          Replies: includeReplies
            ? {
                where: { deletedAt: null },
                take: 5,
                orderBy: { createdAt: "asc" },
              }
            : false,
        },
      });
    } catch (error: unknown) {
      logger.error("Error in getCommentsByProject repository", { error });
      throw error;
    }
  }

  async getCommentCount(projectId: string): Promise<number> {
    try {
      return await prisma.projectComment.count({
        where: {
          projectId,
          parentCommentId: null,
          deletedAt: null,
        },
      });
    } catch (error: unknown) {
      logger.error("Error in getCommentCount repository", { error });
      throw error;
    }
  }

  async getReplies(
    commentId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<ProjectComment[]> {
    try {
      return await prisma.projectComment.findMany({
        where: {
          parentCommentId: commentId,
          deletedAt: null,
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "asc" },
      });
    } catch (error: unknown) {
      logger.error("Error in getReplies repository", { error });
      throw error;
    }
  }

  async getReplyCount(commentId: string): Promise<number> {
    try {
      return await prisma.projectComment.count({
        where: {
          parentCommentId: commentId,
          deletedAt: null,
        },
      });
    } catch (error: unknown) {
      logger.error("Error in getReplyCount repository", { error });
      throw error;
    }
  }

  async incrementLikesCount(commentId: string): Promise<void> {
    try {
      await prisma.projectComment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      });
    } catch (error: unknown) {
      logger.error("Error incrementing comment likes count", { error });
    }
  }

  async decrementLikesCount(commentId: string): Promise<void> {
    try {
      await prisma.projectComment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
      });
    } catch (error: unknown) {
      logger.error("Error decrementing comment likes count", { error });
    }
  }

  async getUserLikesForComments(
    userId: string,
    commentIds: string[]
  ): Promise<Record<string, boolean>> {
    try {
      if (!userId || commentIds.length === 0) {
        return {};
      }

      const reactions = await prisma.projectCommentReaction.findMany({
        where: {
          userId,
          deletedAt: null,
          commentId: {
            in: commentIds,
          },
          type: "LIKE",
        },
        select: {
          commentId: true,
        },
      });

      return reactions.reduce<Record<string, boolean>>((acc, reaction) => {
        acc[reaction.commentId] = true;
        return acc;
      }, {});
    } catch (error: unknown) {
      logger.error("Error getting user likes for comments", {
        error: (error as Error).message,
        userId,
        commentIdsCount: commentIds.length,
      });
      return {};
    }
  }
}
