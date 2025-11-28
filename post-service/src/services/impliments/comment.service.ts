import { ICommentService } from "../interfaces/ICommentService";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { IMentionService } from "../interfaces/IMentionService";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { HttpStatus } from "../../constands/http.status";
import { sanitizeInput, validateContentLength } from "../../utils/xss.util";
import { RedisCacheService } from "../../utils/redis.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import {
  Comment,
  CommentControl,
  OutboxAggregateType,
  OutboxEventType,
} from "@prisma/client";
import { userClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.call.util";
import {
  CheckFollowRequest,
  CheckFollowResponse,
  UserServiceClient,
  getUserForFeedListingRequest,
  getUserForFeedListingResponse,
} from "../../grpc/generated/user";

export class CommentService implements ICommentService {
  constructor(
    private commentRepository: ICommentRepository,
    private postRepository: IPostRepository,
    private mentionService: IMentionService,
    private outboxService: IOutboxService
  ) {}

  /**
   * Get event version for ordering and conflict resolution
   * Uses timestamp as version for simplicity
   */
  private _getEventVersion(): number {
    return Date.now();
  }

  private async _checkFollow(
    followerId: string,
    followingId: string
  ): Promise<boolean> {
    const req = { followerId, followingId };
    const response = await grpcs<
      UserServiceClient,
      CheckFollowRequest,
      CheckFollowResponse
    >(userClient, "checkFollow", req);
    return response.isFollowing;
  }

  async createComment(
    postId: string,
    userId: string,
    content: string,
    parentCommentId?: string
  ): Promise<any> {
    try {
      // Validate post exists
      const post = await this.postRepository.findPost(postId);
      if (!post) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Post not found");
      }

      if (post.commentControl === CommentControl.NONE) {
        throw new CustomError(
          HttpStatus.FORBIDDEN,
          "Comments are disabled for this post"
        );
      }

      if (post.commentControl === CommentControl.CONNECTIONS) {
        const isFollowing = await this._checkFollow(userId, post.userId);
        if (!isFollowing) {
          throw new CustomError(
            HttpStatus.FORBIDDEN,
            "You are not following the post author"
          );
        }
      }

      // Validate parent comment if provided and get parent comment author
      // LinkedIn-style: If replying to a reply, find the main comment and use that instead
      let parentCommentAuthorId: string | undefined;
      let actualParentCommentId: string | undefined;
      
      if (parentCommentId) {
        const parentComment = await this.commentRepository.findComment(
          parentCommentId
        );
        if (!parentComment || parentComment.postId !== postId) {
          throw new CustomError(
            HttpStatus.NOT_FOUND,
            "Parent comment not found"
          );
        }
        
        // LinkedIn-style: If parentComment is itself a reply, use its parent instead
        if (parentComment.parentCommentId) {
          // This is a reply to a reply - use the main comment instead
          actualParentCommentId = parentComment.parentCommentId;
          const mainComment = await this.commentRepository.findComment(
            actualParentCommentId
          );
          if (mainComment) {
            parentCommentAuthorId = mainComment.userId;
          }
        } else {
          // This is a main comment - use it directly
          actualParentCommentId = parentCommentId;
          parentCommentAuthorId = parentComment.userId;
        }
      }

      // Sanitize and validate content
      const sanitizedContent = sanitizeInput(content);
      if (!validateContentLength(sanitizedContent, 5000)) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          "Comment content too long"
        );
      }

      if (sanitizedContent.trim().length === 0) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          "Comment content cannot be empty"
        );
      }

      // Create comment
      const comment = await this.commentRepository.createComment({
        postId,
        userId,
        content: sanitizedContent,
        parentCommentId: actualParentCommentId,
      });

      // Update counter
      await this.postRepository.incrementCommentsCount(postId);

      // Invalidate cache
      await RedisCacheService.invalidatePostCounter(postId, "comments");
      await RedisCacheService.invalidateCommentList(postId);

      // Process mentions
      const mentionedUserIds = await this.mentionService.processMentions(
        sanitizedContent,
        undefined,
        comment.id,
        userId
      );

      const version = this._getEventVersion();
      const eventTimestamp = new Date().toISOString();

      // Create outbox event for comment created
      await this.outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.COMMENT,
        aggregateId: comment.id,
        type: OutboxEventType.POST_COMMENT_CREATED,
        topic: KAFKA_TOPICS.POST_COMMENT_CREATED,
        key: postId,
        payload: {
          commentId: comment.id,
          postId,
          userId,
          postAuthorId: post.userId,
          parentCommentId,
          parentCommentAuthorId,
          content: sanitizedContent,
          mentionedUserIds,
          eventTimestamp,
          version,
          action: "COMMENT_CREATED",
        },
      });

      logger.info(`Comment created: ${comment.id} on post ${postId}`);
      return comment;
    } catch (err: any) {
      logger.error("Error creating comment", {
        error: err.message,
        postId,
        userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Failed to create comment"
          );
    }
  }

  async updateComment(
    commentId: string,
    userId: string,
    content: string
  ): Promise<any> {
    try {
      // Find comment
      const comment = await this.commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      // Check ownership
      if (comment.userId !== userId) {
        throw new CustomError(
          HttpStatus.FORBIDDEN,
          "Not authorized to edit this comment"
        );
      }

      // Sanitize and validate content
      const sanitizedContent = sanitizeInput(content);
      if (!validateContentLength(sanitizedContent, 5000)) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          "Comment content too long"
        );
      }

      // Update comment (editedAt is automatically set by repository)
      const updatedComment = await this.commentRepository.updateComment(
        commentId,
        sanitizedContent
      );

      // Process mentions in updated content
      await this.mentionService.processMentions(
        sanitizedContent,
        undefined,
        commentId,
        userId
      );

      // Invalidate cache
      await RedisCacheService.invalidateCommentList(comment.postId);

      // Get event version and timestamp for ordering
      const version = this._getEventVersion();
      const eventTimestamp = new Date().toISOString();

      // Create outbox event
      await this.outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.COMMENT,
        aggregateId: commentId,
        type: OutboxEventType.POST_COMMENT_EDITED,
        topic: KAFKA_TOPICS.POST_COMMENT_EDITED,
        key: comment.postId,
        payload: {
          commentId,
          postId: comment.postId,
          userId,
          eventTimestamp,
          version,
          action: "COMMENT_EDITED",
          content: sanitizedContent,
        },
      });

      logger.info(`Comment updated: ${commentId}`);
      return updatedComment;
    } catch (err: any) {
      logger.error("Error updating comment", {
        error: err.message,
        commentId,
        userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Failed to update comment"
          );
    }
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    try {
      // Find comment
      const comment = await this.commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      // Get post to check if user is post author
      const post = await this.postRepository.findPost(comment.postId);
      if (!post) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Post not found");
      }

      // Enhanced authorization: check if user is comment owner OR post author
      const isCommentOwner = comment.userId === userId;
      const isPostAuthor = post.userId === userId;

      if (!isCommentOwner && !isPostAuthor) {
        throw new CustomError(
          HttpStatus.FORBIDDEN,
          "Not authorized to delete this comment"
        );
      }

      // Soft delete comment
      await this.commentRepository.deleteComment(commentId);

      // Update counter
      await this.postRepository.decrementCommentsCount(comment.postId);

      // Invalidate cache
      await RedisCacheService.invalidatePostCounter(comment.postId, "comments");
      await RedisCacheService.invalidateCommentList(comment.postId);

      // Get event version and timestamp for ordering
      const version = this._getEventVersion();
      const eventTimestamp = new Date().toISOString();

      // Create outbox event
      await this.outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.COMMENT,
        aggregateId: commentId,
        type: OutboxEventType.POST_COMMENT_DELETED,
        topic: KAFKA_TOPICS.POST_COMMENT_DELETED,
        key: comment.postId,
        payload: {
          commentId,
          postId: comment.postId,
          userId,
          eventTimestamp,
          version,
          action: "COMMENT_DELETED",
        },
      });

      logger.info(`Comment deleted: ${commentId}`);
    } catch (err: any) {
      logger.error("Error deleting comment", {
        error: err.message,
        commentId,
        userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Failed to delete comment"
          );
    }
  }

  /**
   * Enrich a single comment with user data via gRPC
   * LinkedIn-style: Flat replies only, no nested replies
   */
  private async _enrichCommentWithUser(comment: any, postAuthorId?: string): Promise<any> {
    try {
      const userResponse = await grpcs<
        UserServiceClient,
        getUserForFeedListingRequest,
        getUserForFeedListingResponse
      >(userClient, "getUserForFeedListing", { userId: comment.userId });

      return {
        ...comment,
        user: {
          id: comment.userId,
          name: userResponse.name,
          username: userResponse.username,
          avatar: userResponse.avatar,
        },
        // LinkedIn-style: Include isAuthor flag
        isAuthor: postAuthorId ? comment.userId === postAuthorId : false,
        // LinkedIn-style: Flat replies only (no nested replies)
        replies: comment.Replies && comment.Replies.length > 0
          ? await Promise.all(
              comment.Replies.map((reply: any) => this._enrichCommentWithUser(reply, postAuthorId))
            )
          : undefined,
      };
    } catch (error: any) {
      logger.error("Error enriching comment with user data", {
        error: error.message,
        commentId: comment.id,
        userId: comment.userId,
      });
      // Return comment without user data if gRPC fails
      return {
        ...comment,
        user: {
          id: comment.userId,
          name: "Unknown User",
          username: "unknown",
          avatar: "",
        },
        isAuthor: postAuthorId ? comment.userId === postAuthorId : false,
        replies: comment.Replies || undefined,
      };
    }
  }

  /**
   * Enrich multiple comments with user data (batched)
   * LinkedIn-style: Include post author ID for isAuthor flag
   */
  private async _enrichCommentsWithUsers(comments: any[], postAuthorId?: string): Promise<any[]> {
    return Promise.all(
      comments.map((comment) => this._enrichCommentWithUser(comment, postAuthorId))
    );
  }

  async getComments(
    postId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Comment[]> {
    try {
      // Get post to get author ID for isAuthor flag
      const post = await this.postRepository.findPost(postId);
      const postAuthorId = post?.userId;

      if (offset === 0) {
        const cachedComments = await RedisCacheService.getCachedCommentList(
          postId
        );
        if (cachedComments) {
          // Enrich cached comments with user data and isAuthor flag
          return await this._enrichCommentsWithUsers(cachedComments.slice(0, limit), postAuthorId);
        }
      }

      // Get from database with clear parameters
      const comments = await this.commentRepository.getCommentsByPost(
        postId,
        limit,
        offset,
        true, // includeReplies
        true // includeMentions
      );

      // Enrich comments with user data and isAuthor flag
      const enrichedComments = await this._enrichCommentsWithUsers(comments, postAuthorId);

      // Cache if first page (cache raw data, enrichment happens on read)
      if (offset === 0 && enrichedComments.length > 0) {
        // Cache the raw comments (without user data) to avoid stale user info
        await RedisCacheService.cacheCommentList(postId, comments);
      }

      return enrichedComments;
    } catch (err: any) {
      logger.error("Error getting comments", {
        error: err.message,
        postId,
      });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to get comments");
    }
  }

  async getComment(commentId: string): Promise<Comment | null> {
    try {
      return await this.commentRepository.findComment(commentId);
    } catch (err: any) {
      logger.error("Error getting comment", {
        error: err.message,
        commentId,
      });
      throw new CustomError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to get comment"
      );
    }
  }

  async getCommentCount(postId: string): Promise<number> {
    try {
      const cachedCount = await RedisCacheService.getPostComments(postId);
      if (cachedCount !== null) {
        return cachedCount;
      }

      const count = await this.commentRepository.getCommentCount(postId);
      await RedisCacheService.cachePostCommentsCount(postId, count);
      return count;
    } catch (err: any) {
      logger.error("Error getting comment count", {
        error: err.message,
        postId,
      });
      throw new CustomError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to get comment count"
      );
    }
  }

  async getReplies(
    commentId: string,
    limit: number = 10
  ): Promise<Comment[]> {
    try {
      // Get the main comment to find the post and post author
      const mainComment = await this.commentRepository.findComment(commentId);
      if (!mainComment) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      }

      // Get post to get author ID for isAuthor flag
      const post = await this.postRepository.findPost(mainComment.postId);
      const postAuthorId = post?.userId;

      const replies = await this.commentRepository.getReplies(commentId, limit);
      
      // Enrich replies with user data and isAuthor flag
      return await this._enrichCommentsWithUsers(replies, postAuthorId);
    } catch (err: any) {
      logger.error("Error getting replies", {
        error: err.message,
        commentId,
      });
      throw new CustomError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to get replies"
      );
    }
  }

  /**
   * Get comment preview (first comment) for LinkedIn-style display
   * Returns first comment with total count and hasMore flag
   */
  async getCommentPreview(
    postId: string
  ): Promise<{ comment: Comment | null; totalCount: number; hasMore: boolean }> {
    try {
      // Get total count
      const totalCount = await this.getCommentCount(postId);

      // If no comments, return null
      if (totalCount === 0) {
        return {
          comment: null,
          totalCount: 0,
          hasMore: false,
        };
      }

      // Get first comment (limit=1, offset=0)
      const comments = await this.getComments(postId, 1, 0);

      return {
        comment: comments.length > 0 ? comments[0] : null,
        totalCount,
        hasMore: totalCount > 1,
      };
    } catch (err: any) {
      logger.error("Error getting comment preview", {
        error: err.message,
        postId,
      });
      throw new CustomError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Failed to get comment preview"
      );
    }
  }
}
