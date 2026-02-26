import { IProjectCommentService } from "../interfaces/IProjectCommentService";
import { IProjectCommentRepository } from "../../repositories/interface/IProjectCommentRepository";
import { IProjectRepository } from "../../repositories/interface/IProjectRepository";
import { IMentionService } from "../interfaces/IMentionService";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { HttpStatus } from "../../constands/http.status";
import { sanitizeInput, validateContentLength } from "../../utils/xss.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import {
  ProjectComment,
  OutboxAggregateType,
  OutboxEventType,
  ReportReason,
} from "@prisma/client";
import { userClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.util";
import {
  getUserForFeedListingRequest,
  getUserForFeedListingResponse,
} from "../../grpc/generated/user";

export class ProjectCommentService implements IProjectCommentService {
  constructor(
    private _commentRepository: IProjectCommentRepository,
    private _projectRepository: IProjectRepository,
    private _mentionService: IMentionService,
    private _outboxService: IOutboxService
  ) {}

  /**
   * Get event version for ordering and conflict resolution
   */
  private _getEventVersion(): number {
    return Date.now();
  }

  async createComment(
    projectId: string,
    userId: string,
    content: string,
    parentCommentId?: string
  ): Promise<ProjectComment> {
    try {
      // Validate project exists
      const project = await this._projectRepository.findProject(projectId);
      if (!project) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Project not found");
      }

      // LinkedIn-style: If replying to a reply, find the main comment and use that instead
      let parentCommentAuthorId: string | undefined;
      let actualParentCommentId: string | undefined;
      
      if (parentCommentId) {
        const parentComment = await this._commentRepository.findComment(parentCommentId);
        if (!parentComment || parentComment.projectId !== projectId) {
          throw new CustomError(HttpStatus.NOT_FOUND, "Parent comment not found");
        }
        
        if (parentComment.parentCommentId) {
          actualParentCommentId = parentComment.parentCommentId;
          const mainComment = await this._commentRepository.findComment(actualParentCommentId);
          if (mainComment) {
            parentCommentAuthorId = mainComment.userId;
          }
        } else {
          actualParentCommentId = parentCommentId;
          parentCommentAuthorId = parentComment.userId;
        }
      }

      // Sanitize and validate content
      const sanitizedContent = sanitizeInput(content);
      if (!validateContentLength(sanitizedContent, 5000)) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Comment content too long");
      }

      if (sanitizedContent.trim().length === 0) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Comment content cannot be empty");
      }

      // Create comment
      const comment = await this._commentRepository.createComment({
        projectId,
        userId,
        content: sanitizedContent,
        parentCommentId: actualParentCommentId,
      });

      // Update counter
      await this._projectRepository.incrementCommentsCount(projectId);

      // Process mentions
      const mentionedUserIds = await this._mentionService.processMentions(
        sanitizedContent,
        projectId,
        comment.id,
        userId
      );

      const version = this._getEventVersion();
      const eventTimestamp = new Date().toISOString();

      // Create outbox event for comment created
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.PROJECT_COMMENT,
        aggregateId: comment.id,
        type: OutboxEventType.PROJECT_COMMENT_CREATED,
        topic: KAFKA_TOPICS.PROJECT_COMMENT_CREATED,
        key: projectId,
        payload: {
          dedupeId: `comment-${comment.id}-${Date.now()}`,
          commentId: comment.id,
          projectId,
          userId,
          projectAuthorId: project.userId,
          parentCommentId,
          parentCommentAuthorId,
          content: sanitizedContent,
          mentionedUserIds,
          eventTimestamp,
          version,
          action: "PROJECT_COMMENT_CREATED",
        },
      });

      logger.info(`Project comment created: ${comment.id} on project ${projectId}`);
      return comment;
    } catch (err: any) {
      logger.error("Error creating project comment", { error: err.message, projectId, userId });
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create comment");
    }
  }

  async updateComment(
    commentId: string,
    userId: string,
    content: string
  ): Promise<ProjectComment> {
    try {
      const comment = await this._commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      if (comment.userId !== userId) {
        throw new CustomError(HttpStatus.FORBIDDEN, "Not authorized to edit this comment");
      }

      const sanitizedContent = sanitizeInput(content);
      if (!validateContentLength(sanitizedContent, 5000)) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Comment content too long");
      }

      const updatedComment = await this._commentRepository.updateComment(commentId, {
        content: sanitizedContent,
        editedAt: new Date(),
        version: { increment: 1 },
      });

      // Process mentions in updated content
      await this._mentionService.processMentions(
        sanitizedContent,
        comment.projectId,
        commentId,
        userId
      );

      const version = this._getEventVersion();
      const eventTimestamp = new Date().toISOString();

      // Create outbox event
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.PROJECT_COMMENT,
        aggregateId: commentId,
        type: OutboxEventType.PROJECT_COMMENT_EDITED,
        topic: KAFKA_TOPICS.PROJECT_COMMENT_EDITED,
        key: comment.projectId,
        payload: {
          dedupeId: `comment-edit-${commentId}-${Date.now()}`,
          commentId,
          projectId: comment.projectId,
          userId,
          eventTimestamp,
          version,
          action: "PROJECT_COMMENT_EDITED",
          content: sanitizedContent,
        },
      });

      return updatedComment;
    } catch (err: any) {
      logger.error("Error updating project comment", { error: err.message, commentId, userId });
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to update comment");
    }
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    try {
      const comment = await this._commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      const project = await this._projectRepository.findProject(comment.projectId);
      if (!project) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Project not found");
      }

      const isCommentOwner = comment.userId === userId;
      const isProjectAuthor = project.userId === userId;

      if (!isCommentOwner && !isProjectAuthor) {
        throw new CustomError(HttpStatus.FORBIDDEN, "Not authorized to delete this comment");
      }

      await this._commentRepository.deleteComment(commentId);

      // Update counter
      await this._projectRepository.decrementCommentsCount(comment.projectId);

      const version = this._getEventVersion();
      const eventTimestamp = new Date().toISOString();

      // Create outbox event
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.PROJECT_COMMENT,
        aggregateId: commentId,
        type: OutboxEventType.PROJECT_COMMENT_DELETED,
        topic: KAFKA_TOPICS.PROJECT_COMMENT_DELETED,
        key: comment.projectId,
        payload: {
          dedupeId: `comment-delete-${commentId}-${Date.now()}`,
          commentId,
          projectId: comment.projectId,
          userId,
          eventTimestamp,
          version,
          action: "PROJECT_COMMENT_DELETED",
        },
      });

      logger.info(`Project comment deleted: ${commentId}`);
    } catch (err: any) {
      logger.error("Error deleting project comment", { error: err.message, commentId, userId });
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to delete comment");
    }
  }

  private async _enrichCommentWithUser(
    comment: any,
    projectAuthorId?: string,
    userLikesMap?: Record<string, boolean>
  ): Promise<any> {
    try {
      const userResponse = await grpcs<typeof userClient, getUserForFeedListingRequest, getUserForFeedListingResponse>(
        userClient,
        "getUserForFeedListing",
        { userId: comment.userId }
      );

      return {
        ...comment,
        user: {
          id: comment.userId,
          name: userResponse.name,
          username: userResponse.username,
          avatar: userResponse.avatar,
        },
        isAuthor: projectAuthorId ? comment.userId === projectAuthorId : false,
        isLiked: userLikesMap ? userLikesMap[comment.id] || false : false,
        replies: comment.Replies && comment.Replies.length > 0
          ? await Promise.all(
              comment.Replies.map((reply: any) => this._enrichCommentWithUser(reply, projectAuthorId, userLikesMap))
            )
          : undefined,
      };
    } catch (error: any) {
      logger.error("Error enriching project comment with user data", { error: error.message, commentId: comment.id, userId: comment.userId });
      return {
        ...comment,
        user: { id: comment.userId, name: "Unknown User", username: "unknown", avatar: "" },
        isAuthor: projectAuthorId ? comment.userId === projectAuthorId : false,
        isLiked: userLikesMap ? userLikesMap[comment.id] || false : false,
        replies: comment.Replies || undefined,
      };
    }
  }

  private async _enrichCommentsWithUsers(
    comments: any[],
    projectAuthorId?: string,
    userLikesMap?: Record<string, boolean>
  ): Promise<any[]> {
    return Promise.all(
      comments.map((comment) => this._enrichCommentWithUser(comment, projectAuthorId, userLikesMap))
    );
  }

  async getComments(
    projectId: string,
    limit: number = 20,
    offset: number = 0,
    userId?: string
  ): Promise<any[]> {
    try {
      const project = await this._projectRepository.findProject(projectId);
      const projectAuthorId = project?.userId;

      const comments = await this._commentRepository.getCommentsByProject(projectId, limit, offset, true);

      // Extract all comment IDs for batch like lookup
      const allCommentIds = this._extractCommentIds(comments);

      let userLikesMap: Record<string, boolean> = {};
      if (userId && allCommentIds.length > 0) {
        userLikesMap = await this._commentRepository.getUserLikesForComments(userId, allCommentIds);
      }

      return await this._enrichCommentsWithUsers(comments, projectAuthorId, userLikesMap);
    } catch (err: any) {
      logger.error("Error getting project comments", { error: err.message, projectId });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to get comments");
    }
  }

  async getCommentCount(projectId: string): Promise<number> {
    return this._commentRepository.getCommentCount(projectId);
  }

  async getReplies(
    commentId: string,
    limit: number = 10,
    userId?: string
  ): Promise<any[]> {
    try {
      const mainComment = await this._commentRepository.findComment(commentId);
      if (!mainComment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      const project = await this._projectRepository.findProject(mainComment.projectId);
      const projectAuthorId = project?.userId;

      const replies = await this._commentRepository.getReplies(commentId, limit);
      const replyIds = replies.map((reply) => reply.id);

      let userLikesMap: Record<string, boolean> = {};
      if (userId && replyIds.length > 0) {
        userLikesMap = await this._commentRepository.getUserLikesForComments(userId, replyIds);
      }

      return await this._enrichCommentsWithUsers(replies, projectAuthorId, userLikesMap);
    } catch (err: any) {
      logger.error("Error getting project replies", { error: err.message, commentId });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to get replies");
    }
  }

  async likeComment(commentId: string, userId: string): Promise<void> {
    try {
      const comment = await this._commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      const prisma = (await import("../../config/prisma.config")).prisma;

      // Check if already liked (idempotent)
      const existing = await prisma.projectCommentReaction.findFirst({
        where: { commentId, userId, type: "LIKE", deletedAt: null },
      });
      if (existing) {
        logger.info(`Project comment ${commentId} already liked by ${userId}`);
        return;
      }

      // Upsert the reaction (handles soft-deleted likes)
      await prisma.projectCommentReaction.upsert({
        where: { commentId_userId_type: { commentId, userId, type: "LIKE" } },
        update: { deletedAt: null },
        create: { commentId, userId, type: "LIKE" },
      });

      // Increment counter
      await this._commentRepository.incrementLikesCount(commentId);

      // Emit outbox event for notification
      const version = this._getEventVersion();
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.PROJECT_COMMENT_LIKE,
        aggregateId: commentId,
        type: OutboxEventType.PROJECT_COMMENT_LIKE_CREATED,
        topic: KAFKA_TOPICS.PROJECT_COMMENT_LIKE_CREATED,
        key: commentId,
        payload: {
          dedupeId: `comment-like-${commentId}-${userId}-${Date.now()}`,
          commentId,
          userId,
          commentAuthorId: comment.userId,
          projectId: comment.projectId,
          eventTimestamp: new Date().toISOString(),
          version,
          action: "LIKE",
        },
      });

      logger.info(`Project comment liked: ${commentId} by ${userId}`);
    } catch (err: any) {
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to like comment");
    }
  }

  async unlikeComment(commentId: string, userId: string): Promise<void> {
    try {
      const comment = await this._commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      const prisma = (await import("../../config/prisma.config")).prisma;

      // Soft-delete the reaction
      const deleted = await prisma.projectCommentReaction.updateMany({
        where: { commentId, userId, type: "LIKE", deletedAt: null },
        data: { deletedAt: new Date() },
      });

      if (deleted.count === 0) {
        // Not liked - return silently (idempotent)
        logger.info(`Project comment ${commentId} not liked by ${userId}, skipping unlike`);
        return;
      }

      // Decrement counter
      await this._commentRepository.decrementLikesCount(commentId);

      // Emit outbox event for notification removal
      const version = this._getEventVersion();
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.PROJECT_COMMENT_LIKE,
        aggregateId: commentId,
        type: OutboxEventType.PROJECT_COMMENT_LIKE_REMOVED,
        topic: KAFKA_TOPICS.PROJECT_COMMENT_LIKE_REMOVED,
        key: commentId,
        payload: {
          dedupeId: `comment-unlike-${commentId}-${userId}-${Date.now()}`,
          commentId,
          userId,
          commentAuthorId: comment.userId,
          projectId: comment.projectId,
          eventTimestamp: new Date().toISOString(),
          version,
          action: "UNLIKE",
        },
      });

      logger.info(`Project comment unliked: ${commentId} by ${userId}`);
    } catch (err: any) {
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to unlike comment");
    }
  }

  async reportComment(commentId: string, userId: string, reason: string): Promise<void> {
    try {
      const comment = await this._commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      // Upsert a project report for the comment
      const prisma = (await import("../../config/prisma.config")).prisma;
      const reportReason = reason as ReportReason;
      await prisma.projectReport.upsert({
        where: {
          reporterId_projectId_commentId: {
            reporterId: userId,
            projectId: comment.projectId,
            commentId,
          },
        },
        update: { reason: reportReason },
        create: {
          reporterId: userId,
          projectId: comment.projectId,
          commentId,
          reason: reportReason,
        },
      });
      logger.info(`Project comment reported: ${commentId} by ${userId}`);
    } catch (err: any) {
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to report comment");
    }
  }

  private _extractCommentIds(comments: any[]): string[] {
    const ids: string[] = [];
    const extract = (comment: any) => {
      ids.push(comment.id);
      if (comment.Replies && comment.Replies.length > 0) {
        comment.Replies.forEach((reply: any) => extract(reply));
      }
    };
    comments.forEach((comment) => extract(comment));
    return ids;
  }
}
