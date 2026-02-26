import { prisma } from "../../config/prisma.config";
import { ProjectCommentMention } from "@prisma/client";
import { IMentionRepository } from "../interface/IMentionRepository";
import logger from "../../utils/logger.util";

export class MentionRepository implements IMentionRepository {
  // Note: We only have ProjectCommentMention for now. 
  // If we need ProjectMentions (mentions in project description), we can add it later.
  // For now, I'll implement createProjectMention as a placeholder or throw error.
  
  async createProjectMention(data: {
    projectId: string;
    mentionedUserId: string;
    actorId: string;
  }): Promise<any> {
    logger.warn("createProjectMention not implemented as ProjectMention model is missing in schema");
    return null;
  }

  async createCommentMention(data: {
    commentId: string;
    mentionedUserId: string;
    actorId: string;
  }): Promise<ProjectCommentMention> {
    try {
      return prisma.projectCommentMention.upsert({
        where: {
          commentId_mentionedUserId: {
            commentId: data.commentId,
            mentionedUserId: data.mentionedUserId,
          },
        },
        update: {},
        create: {
          commentId: data.commentId,
          actorId: data.actorId,
          mentionedUserId: data.mentionedUserId,
        },
      });
    } catch (error: any) {
      logger.error("Error creating comment mention", { error: error.message });
      throw new Error("Database error");
    }
  }

  async getProjectMentions(projectId: string): Promise<any[]> {
    return [];
  }

  async getCommentMentions(commentId: string): Promise<ProjectCommentMention[]> {
    try {
      return await prisma.projectCommentMention.findMany({
        where: { commentId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting comment mentions", { error: error.message });
      throw new Error("Failed to get comment mentions");
    }
  }

  async deleteProjectMentions(projectId: string): Promise<void> {
    // No-op
  }

  async deleteCommentMentions(commentId: string): Promise<void> {
    try {
      await prisma.projectCommentMention.deleteMany({ where: { commentId } });
    } catch (error: any) {
      logger.error("Error deleting comment mentions", { error: error.message });
      throw new Error("Failed to delete comment mentions");
    }
  }
}
