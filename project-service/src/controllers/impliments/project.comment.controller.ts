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
      const userId = req.headers["x-user-data"] ? getUserIdFromRequest(req) : undefined;
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
      const userId = req.headers["x-user-data"] ? getUserIdFromRequest(req) : undefined;
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
      const { commentId } = req.params;
      const userId = getUserIdFromRequest(req);
      await this._commentService.likeComment(commentId as string, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Comment liked successfully",
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
      const { commentId } = req.params;
      const userId = getUserIdFromRequest(req);
      await this._commentService.unlikeComment(commentId as string, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Comment unliked successfully",
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
      const { commentId } = req.params;
      const { reason } = req.body;
      const userId = req.headers["x-user-id"] as string;

      await this._commentService.reportComment(
        commentId as string,
        userId,
        reason
      );

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Comment reported successfully",
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async getCommentCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const count = await this._commentService.getCommentCount(projectId as string);

      res.status(HttpStatus.OK).json({
        success: true,
        count,
      });
    } catch (error: unknown) {
      next(error);
    }
  }
}
