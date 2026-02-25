import { Request, response, Response } from "express";

import logger from "../../utils/logger.util";
import { CustomError, sendErrorResponse } from "../../utils/error.util";
import { HttpStatus } from "../../constents/httpStatus";
import { Messages } from "../../constents/reqresMessages";
import { IAdminService } from "../../services/interface/IadminService";
import { IAdminController } from "../interface/IadminController";

export class AdminController implements IAdminController {
  constructor(private _adminService: IAdminService) {}

  async getUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const search = req.query.search as string;
      const date = req.query.date as string;

      const { users, total } = await this._adminService.getUsers(
        page,
        limit,
        status,
        search,
        date
      );
      res.json({
        success: true,
        data: {
          users,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err: unknown) {
      logger.error("Get users error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async getUserFullDetails(req: Request, res: Response) {
    try {
      const userId = req.params.id as string;
      const user = await this._adminService.getUserFullDetails(userId);
      res.status(HttpStatus.OK).json({
        success: true,
        data: user,
      });
    } catch (err: unknown) {
      logger.error("Get usersFullDetails error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async toogleUserState(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const reason = req.body.reason as string;
      const adminId = (req as any).user?.id;

      if (!id) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.INCOMPLETE_FORM);
      }
      
      logger.info(`Toogling user ${id} by admin ${adminId}`);
      await this._adminService.toogleUserState(id, adminId, reason);
      res.status(HttpStatus.OK).json({ success: true });
    } catch (err: unknown) {
      logger.error("Toogling user error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  // Reporting implementation
  async submitReport(req: Request, res: Response) {
    try {
      const reporterId = (req as any).user?.id;
      const { targetId, targetType, reason, description, metadata } = req.body;

      if (!targetId || !targetType || !reason) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.INCOMPLETE_FORM);
      }

      const report = await this._adminService.createReport({
        reporterId,
        targetId,
        targetType,
        reason,
        description,
        metadata
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: report
      });
    } catch (err: unknown) {
      logger.error("Submit report error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }

  async getReports(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as any;
      const targetType = req.query.targetType as any;
      const severity = req.query.severity as any;
      const reason = req.query.reason as any;
      const search = req.query.search as string;
      const sortBy = (req.query.sortBy as "createdAt" | "severity" | "status") || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const { reports, total } = await this._adminService.getReports({
        page,
        limit,
        status,
        targetType,
        severity,
        reason,
        search,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        data: { reports, total, page, limit, totalPages: Math.ceil(total / limit) }
      });
    } catch (err: unknown) {
      logger.error("Get reports error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }

  async getReportById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const report = await this._adminService.getReportById(id);
      if (!report) throw new CustomError(HttpStatus.NOT_FOUND, "Report not found");

      res.json({ success: true, data: report });
    } catch (err: unknown) {
      logger.error("Get report by id error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }

  async processReportAction(req: Request, res: Response) {
    try {
      const reportId = req.params.id as string;
      const adminId = (req as any).user?.id;
      const { status, resolution, enforcementAction, severity } = req.body;

      if (!status || !resolution) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.INCOMPLETE_FORM);
      }

      const report = await this._adminService.processReportAction(reportId, adminId, {
        status,
        resolution,
        enforcementAction,
        severity
      });

      res.json({ success: true, data: report });
    } catch (err: unknown) {
      logger.error("Process report action error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }

  async getAuditLogs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const adminId = req.query.adminId as string;
      const targetType = req.query.targetType as string;
      const search = req.query.search as string;
      const action = req.query.action as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const { logs, total } = await this._adminService.getAuditLogs({
        page,
        limit,
        adminId,
        targetType,
        search,
        action,
        startDate,
        endDate
      });

      res.json({
        success: true,
        data: { logs, total, page, limit, totalPages: Math.ceil(total / limit) }
      });
    } catch (err: unknown) {
      logger.error("Get audit logs error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }

  async bulkReportAction(req: Request, res: Response) {
    try {
      const adminId = (req as any).user?.id;
      const { reportIds, action, resolution } = req.body;

      if (!reportIds || !Array.isArray(reportIds) || !action) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.INCOMPLETE_FORM);
      }

      const result = await this._adminService.bulkReportAction(adminId, {
        reportIds,
        action,
        resolution
      });

      res.json(result);
    } catch (err: unknown) {
      logger.error("Bulk report action error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }

  // Analytics implementation
  async getDashboardStats(req: Request, res: Response) {
    try {
      const stats = await this._adminService.getDashboardStats();
      res.json({ success: true, data: stats });
    } catch (err: unknown) {
      logger.error("Get dashboard stats error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }

  async getReportsByReason(req: Request, res: Response) {
    try {
      const reports = await this._adminService.getReportsByReason();
      res.json({ success: true, data: reports });
    } catch (err: unknown) {
      logger.error("Get reports by reason error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }

  async getReportsBySeverity(req: Request, res: Response) {
    try {
      const reports = await this._adminService.getReportsBySeverity();
      res.json({ success: true, data: reports });
    } catch (err: unknown) {
      logger.error("Get reports by severity error", { error: (err as Error).message });
      sendErrorResponse(res, err instanceof CustomError ? err : { status: 500, message: "Server error" });
    }
  }
}
