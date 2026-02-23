import { IProjectCommentService } from "../interfaces/IProjectCommentService";
import { IProjectCommentRepository } from "../../repositories/interface/IProjectCommentRepository";
import { IProjectRepository } from "../../repositories/interface/IProjectRepository";
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
    private _outboxService: IOutboxService
  ) {}

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

      // LinkedIn-style: Flat structure for replies
      let actualParentCommentId: string | undefined;
      let parentCommentAuthorId: string | undefined;

      if (parentCommentId) {
        const parentComment = await this._commentRepository.findComment(parentCommentId);
        if (!parentComment || parentComment.projectId !== projectId) {
          throw new CustomError(HttpStatus.NOT_FOUND, "Parent comment not found");
        }

        // If replying to a reply, use the main comment instead
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

      // Update project comment counter
      await this._projectRepository.incrementCommentsCount(projectId);

      // Create outbox event for notification
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
          parentCommentId: actualParentCommentId,
          parentCommentAuthorId,
          content: sanitizedContent,
          action: "PROJECT_COMMENT_CREATED",
          version: Date.now(),
          eventTimestamp: new Date().toISOString(),
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
          content: sanitizedContent,
          action: "PROJECT_COMMENT_EDITED",
          version: Date.now(),
          eventTimestamp: new Date().toISOString(),
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

      if (comment.userId !== userId) {
        throw new CustomError(HttpStatus.FORBIDDEN, "Not authorized to delete this comment");
      }

      await this._commentRepository.deleteComment(commentId);

      // Update project comment counter
      await this._projectRepository.decrementCommentsCount(comment.projectId);

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
          action: "PROJECT_COMMENT_DELETED",
          version: Date.now(),
          eventTimestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      logger.error("Error deleting project comment", { error: err.message, commentId, userId });
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to delete comment");
    }
  }

  async getComments(
    projectId: string,
    limit: number = 20,
    offset: number = 0,
    userId?: string
  ): Promise<any[]> {
    try {
      const comments = await this._commentRepository.getCommentsByProject(projectId, limit, offset);
      return await this._enrichCommentsWithUsers(comments);
    } catch (err: any) {
      logger.error("Error fetching project comments", { error: err.message, projectId });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to fetch comments");
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
      const replies = await this._commentRepository.getReplies(commentId, limit);
      return await this._enrichCommentsWithUsers(replies);
    } catch (err: any) {
      logger.error("Error fetching project comment replies", { error: err.message, commentId });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to fetch replies");
    }
  }

  private async _enrichCommentsWithUsers(comments: ProjectComment[]): Promise<any[]> {
    if (comments.length === 0) return [];

    const userIds = Array.from(new Set(comments.map((c) => c.userId)));
    const usersMap = new Map<string, any>();

    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const user = await grpcs<typeof userClient, getUserForFeedListingRequest, getUserForFeedListingResponse>(
            userClient,
            "getUserForFeedListing",
            { userId: uid }
          );
          usersMap.set(uid, {
            id: uid,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
          });
        } catch (error) {
          logger.error(`Error fetching user ${uid} for enrichment`, { error });
          usersMap.set(uid, {
            id: uid,
            name: "Unknown User",
            username: "unknown",
            avatar: "",
          });
        }
      })
    );

    return comments.map((c) => ({
      ...c,
      user: usersMap.get(c.userId),
    }));
  }
}
