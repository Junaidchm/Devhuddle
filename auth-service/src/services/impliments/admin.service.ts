import { User, Report, AuditLog, ReportStatus, ReportTargetType, ReportSeverity, ReportReason } from "@prisma/client";
import { IAdminRepository } from "../../repositories/interfaces/IAdminRepository";
import logger from "../../utils/logger.util";
import { CustomError } from "../../utils/error.util";
import { setUsertoBlockBlackList } from "../../utils/redis.actions";
import { IAdminService } from "../interface/IadminService";

export class AdminService implements IAdminService {
  constructor(private _adminRepository: IAdminRepository) {}

  async getUsers(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    date?: string
  ): Promise<{ users: Partial<User>[]; total: number }> {
    try {
      if (page < 1 || limit < 1) {
        logger.error("Invalid page or limit parameters", { page, limit });
        throw new CustomError(400, "Invalid page or limit");
      }
      return await this._adminRepository.findManyPaginated(
        page,
        limit,
        status,
        search,
        date
      );
    } catch (error: unknown) {
      logger.error("Error fetching users", { error: (error as Error).message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }

  async getUserFullDetails(userId: string): Promise<Partial<User> | null> {
    try {
      const user = await this._adminRepository.findUserFullDetails(userId);
      if (!user) {
        logger.error(`user not found for this id : ${userId}`);
        throw new CustomError(404, "user Not found");
      }

      return user;
    } catch (error: unknown) {
      logger.error("Error fetching users", { error: (error as Error).message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  } 

  async toogleUserState(userId: string, adminId: string, reason?: string): Promise<void> {
    try {
      const user = await this._adminRepository.findById(userId);
      if (!user) {
        logger.error(`User not found: ${userId}`);
        throw new CustomError(404, "User not found");
      }

      const updatedUser = await this._adminRepository.toogleUserBlock(userId);
      await setUsertoBlockBlackList(updatedUser.id, updatedUser.isBlocked);

      // Audit the toggle action
      await this._adminRepository.createAuditLog({
        admin: { connect: { id: adminId } },
        action: updatedUser.isBlocked ? "USER_BLOCKED" : "USER_UNBLOCKED",
        targetType: "USER",
        targetId: userId,
        reason: reason || "Manual toggle by admin",
      });

      // Emit outbox event for user state toggle
      await this._adminRepository.createOutboxEvent({
        aggregateType: "USER",
        aggregateId: userId,
        eventType: updatedUser.isBlocked ? "USER_BLOCKED" : "USER_UNBLOCKED",
        topic: "user-state-toggled",
        payload: {
          userId,
          adminId,
          isBlocked: updatedUser.isBlocked,
          reason: reason || "Manual toggle",
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error: unknown) {
      logger.error(`Error Toogling user: ${userId}`, { error: (error as Error).message });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Server error");
    }
  }

  // Reporting implementation
  async createReport(data: {
    reporterId: string;
    targetId: string;
    targetType: ReportTargetType;
    reason: any;
    description?: string;
    metadata?: any;
  }): Promise<Report> {
    try {
      logger.info("AdminService.createReport called", { 
        reporterId: data.reporterId, 
        targetId: data.targetId, 
        targetType: data.targetType,
        reason: data.reason
      });

      const report = await this._adminRepository.createReport({
        reporter: { connect: { id: data.reporterId } },
        targetId: data.targetId,
        targetType: data.targetType,
        reason: data.reason,
        description: data.description,
        metadata: data.metadata,
      });

      logger.info("Report created successfully in database", { reportId: report.id });
      return report;
    } catch (error: unknown) {
      logger.error("Error creating report in database", { 
        error: (error as Error).message,
        data: {
          reporterId: data.reporterId,
          targetId: data.targetId,
          targetType: data.targetType
        }
      });
      throw new CustomError(500, "Failed to create report");
    }
  }

  async getReports(params: {
    page: number;
    limit: number;
    status?: ReportStatus;
    targetType?: ReportTargetType;
    severity?: ReportSeverity;
    reason?: ReportReason;
    search?: string;
    sortBy?: "createdAt" | "severity" | "status";
    sortOrder?: "asc" | "desc";
  }): Promise<{ reports: Report[]; total: number }> {
    return this._adminRepository.findReports(params);
  }

  async getReportById(id: string): Promise<Report | null> {
    return this._adminRepository.findReportById(id);
  }

  /**
   * Core moderation orchestrator (Simplified Saga entry point)
   */
  async processReportAction(reportId: string, adminId: string, action: {
    status: ReportStatus;
    resolution: string;
    enforcementAction?: 'SUSPEND' | 'BAN' | 'HIDE' | 'WARN' | 'UNHIDE' | 'DELETE';
    severity?: ReportSeverity;
  }): Promise<Report> {
    try {
      const report = await this._adminRepository.findReportById(reportId);
      if (!report) throw new CustomError(404, "Report not found");

      // 1. Update Report status
      const updatedReport = await this._adminRepository.updateReport(reportId, {
        status: action.status,
        resolution: action.resolution,
        severity: action.severity,
        resolvedAt: new Date(),
        reviewer: { connect: { id: adminId } },
      });

      // 2. Log Admin Action
      await this._adminRepository.createAuditLog({
        admin: { connect: { id: adminId } },
        action: `REPORT_RESOLVED_${action.enforcementAction || 'NONE'}`,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: action.resolution,
      });

      // 3. Trigger Enforcement Saga via Outbox (Atomic Transaction)
      if (action.enforcementAction) {
        await this._adminRepository.createOutboxEvent({
          aggregateType: report.targetType,
          aggregateId: report.targetId,
          eventType: `MODERATION_${action.enforcementAction}`,
          topic: "admin-action-enforced",
          payload: {
            reportId,
            adminId,
            action: action.enforcementAction,
            targetId: report.targetId,
            targetType: report.targetType,
            ownerId: (report.metadata as any)?.ownerId,
            reason: action.resolution,
            timestamp: new Date().toISOString(),
            version: Date.now(),
          },
        });
        
        // If the action is immediate suspension of user, handle it locally
        if (action.enforcementAction === 'SUSPEND' && report.targetType === 'USER') {
          await this.toogleUserState(report.targetId, adminId, action.resolution);
        }
      }

      return updatedReport;
    } catch (error: unknown) {
      logger.error(`Error processing report: ${reportId}`, { error: (error as Error).message });
      throw error instanceof CustomError ? error : new CustomError(500, "Moderation failed");
    }
  }

  async getAuditLogs(params: {
    page: number;
    limit: number;
    adminId?: string;
    targetType?: string;
    search?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    return this._adminRepository.findAuditLogs(params);
  }

  async bulkReportAction(adminId: string, data: {
    reportIds: string[];
    action: "APPROVE" | "REMOVE" | "IGNORE";
    resolution?: string;
  }): Promise<{ success: boolean; count: number }> {
    try {
      let count = 0;
      for (const reportId of data.reportIds) {
        try {
          await this.processReportAction(reportId, adminId, {
            status: data.action === "APPROVE" ? ReportStatus.RESOLVED_APPROVED : 
                    data.action === "REMOVE" ? ReportStatus.RESOLVED_REMOVED : 
                    ReportStatus.RESOLVED_IGNORED,
            resolution: data.resolution || `Bulk ${data.action.toLowerCase()} action`,
            enforcementAction: data.action === "REMOVE" ? "HIDE" : undefined
          });
          count++;
        } catch (err) {
          logger.error(`Failed to process report ${reportId} in bulk action`, { error: err });
        }
      }
      return { success: true, count };
    } catch (error: unknown) {
      logger.error("Error in bulkReportAction", { error: (error as Error).message });
      throw new CustomError(500, "Bulk action failed");
    }
  }

  // Analytics implementation
  async getDashboardStats(): Promise<any> {
    return this._adminRepository.getDashboardStats();
  }

  async getReportsByReason(): Promise<any[]> {
    return this._adminRepository.getReportsByReason();
  }

  async getReportsBySeverity(): Promise<any[]> {
    return this._adminRepository.getReportsBySeverity();
  }
}
