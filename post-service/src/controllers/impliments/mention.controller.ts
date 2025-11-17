import { Request, Response, NextFunction } from "express";
import { IMentionRepository } from "../../repositories/interface/IMentionRepository";
import { IMentionService } from "../../services/interfaces/IMentionService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";

export class MentionController {
  constructor(
    private mentionRepository: IMentionRepository,
    private mentionService: IMentionService
  ) {}

  /**
   * Get all mentions in a post
   * GET /posts/:postId/mentions
   */
  async getPostMentions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;

      if (!postId) {
        throw new CustomError(400, "Post ID is required");
      }

      const mentions = await this.mentionRepository.getPostMentions(postId);

      res.status(200).json({
        success: true,
        data: mentions,
        count: mentions.length,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all mentions in a comment
   * GET /comments/:commentId/mentions
   */
  async getCommentMentions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;

      if (!commentId) {
        throw new CustomError(400, "Comment ID is required");
      }

      const mentions = await this.mentionRepository.getCommentMentions(commentId);

      res.status(200).json({
        success: true,
        data: mentions,
        count: mentions.length,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Process mentions from content (manual trigger - typically used internally)
   * POST /mentions/process
   * This endpoint is mainly for testing or manual reprocessing
   */
  async processMentions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, postId, commentId } = req.body;
      const actorId = (req as any).user?.userId || (req as any).user?.id;

      if (!actorId) {
        throw new CustomError(401, "Unauthorized");
      }

      if (!content || typeof content !== "string") {
        throw new CustomError(400, "Content is required");
      }

      if (!postId && !commentId) {
        throw new CustomError(400, "Either postId or commentId is required");
      }

      if (postId && commentId) {
        throw new CustomError(400, "Cannot provide both postId and commentId");
      }

      const mentionedUserIds = await this.mentionService.processMentions(
        content,
        postId,
        commentId,
        actorId
      );

      res.status(200).json({
        success: true,
        message: "Mentions processed successfully",
        data: {
          mentionedUserIds,
          count: mentionedUserIds.length,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
}