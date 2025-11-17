import { Request, Response, NextFunction } from "express";
import { IReportService } from "../../services/interfaces/IReportService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { ReportReason } from "@prisma/client";
import { IReportController } from "../interfaces/IReportController";

export class ReportController implements IReportController {
  constructor(private reportService: IReportService) {}

  async reportPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const { reason, metadata } = req.body;
      const reporterId = (req as any).user?.userId || (req as any).user?.id;

      if (!reporterId) {
        throw new CustomError(401, "Unauthorized");
      }

      if (!postId) {
        throw new CustomError(400, "Post ID is required");
      }

      if (!reason || !Object.values(ReportReason).includes(reason)) {
        throw new CustomError(400, "Valid report reason is required");
      }

      const report = await this.reportService.reportPost(postId, reporterId, reason, metadata);

      res.status(201).json({
        success: true,
        message: "Post reported successfully",
        data: report,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async reportComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const { reason, metadata } = req.body;
      const reporterId = (req as any).user?.userId || (req as any).user?.id;

      if (!reporterId) {
        throw new CustomError(401, "Unauthorized");
      }

      if (!commentId) {
        throw new CustomError(400, "Comment ID is required");
      }

      if (!reason || !Object.values(ReportReason).includes(reason)) {
        throw new CustomError(400, "Valid report reason is required");
      }

      const report = await this.reportService.reportComment(commentId, reporterId, reason, metadata);

      res.status(201).json({
        success: true,
        message: "Comment reported successfully",
        data: report,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getReportCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetType, targetId } = req.query;

      if (!targetType || !targetId) {
        throw new CustomError(400, "Target type and target ID are required");
      }

      const count = await this.reportService.getReportCount(targetType as string, targetId as string);

      res.status(200).json({
        success: true,
        count,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async hasReported(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetType, targetId } = req.query;
      const reporterId = (req as any).user?.userId || (req as any).user?.id;

      if (!reporterId) {
        throw new CustomError(401, "Unauthorized");
      }

      if (!targetType || !targetId) {
        throw new CustomError(400, "Target type and target ID are required");
      }

      const hasReported = await this.reportService.hasReported(
        targetType as string,
        targetId as string,
        reporterId
      );

      res.status(200).json({
        success: true,
        hasReported,
      });
    } catch (error: any) {
      next(error);
    }
  }
}