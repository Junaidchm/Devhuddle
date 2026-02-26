import { Request, Response, NextFunction } from "express";
import { IProjectCommentService } from "../../services/interfaces/IProjectCommentService";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import { getUserIdFromRequest } from "../../utils/request.util";

export class ProjectCommentController {
  constructor(private _commentService: IProjectCommentService) {}

  async createComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { content, parentCommentId } = req.body;
      const userId = getUserIdFromRequest(req);

      const comment = await this._commentService.createComment(
        projectId as string,
        userId,
        content,
        parentCommentId
      );

      res.status(HttpStatus.CREATED).json({
        success: true,
        message: "Comment created successfully",
        data: comment,
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async updateComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = getUserIdFromRequest(req);

      const comment = await this._commentService.updateComment(
        commentId as string,
        userId,
        content
      );

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Comment updated successfully",
        data: comment,
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async deleteComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = getUserIdFromRequest(req);

      await this._commentService.deleteComment(commentId as string, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Comment deleted successfully",
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async getComments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.headers["x-user-id"] as string;

      const comments = await this._commentService.getComments(
        projectId as string,
        limit,
        offset,
        userId
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: comments,
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async getReplies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { commentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.headers["x-user-id"] as string;

      const replies = await this._commentService.getReplies(
        commentId as string,
        limit,
        userId
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: replies,
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async likeComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const commentId = req.params.commentId as string;
      const userId = getUserIdFromRequest(req);

      await this._commentService.likeComment(commentId, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Comment liked successfully",
        data: { isLiked: true },
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async unlikeComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const commentId = req.params.commentId as string;
      const userId = getUserIdFromRequest(req);

      await this._commentService.unlikeComment(commentId, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Comment unliked successfully",
        data: { isLiked: false },
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async reportComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const commentId = req.params.commentId as string;
      const { reason } = req.body;
      const userId = getUserIdFromRequest(req);

      await this._commentService.reportComment(commentId, userId, reason);

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Comment reported successfully",
      });
    } catch (error: unknown) {
      next(error);
    }
  }
}
