import { User, Report, AuditLog, ReportStatus, ReportTargetType, ReportSeverity } from "@prisma/client";

export interface IAdminService {
  // User Management
  getUsers(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    date?: string
  ): Promise<{ users: Partial<User>[]; total: number }>;

  getUserFullDetails(userId: string): Promise<Partial<User> | null>;

  toogleUserState(userId: string, adminId: string, reason?: string): Promise<void>;

  // Reporting & Moderation
  createReport(data: {
    reporterId: string;
    targetId: string;
    targetType: ReportTargetType;
    reason: any; // ReportReason enum from Prisma
    description?: string;
    metadata?: any;
  }): Promise<Report>;

  getReports(params: {
    page: number;
    limit: number;
    status?: ReportStatus;
    targetType?: ReportTargetType;
    severity?: ReportSeverity;
  }): Promise<{ reports: Report[]; total: number }>;

  getReportById(id: string): Promise<Report | null>;

  /**
   * Process a report and trigger enforcement actions via Sagas
   */
  processReportAction(reportId: string, adminId: string, action: {
    status: ReportStatus;
    resolution: string;
    enforcementAction?: 'SUSPEND' | 'BAN' | 'HIDE' | 'WARN';
    severity?: ReportSeverity;
  }): Promise<Report>;

  bulkReportAction(adminId: string, data: {
    reportIds: string[];
    action: "APPROVE" | "REMOVE" | "IGNORE";
    resolution?: string;
  }): Promise<{ success: boolean; count: number }>;

  // Auditing
  getAuditLogs(params: {
    page: number;
    limit: number;
    adminId?: string;
    targetType?: string;
  }): Promise<{ logs: AuditLog[]; total: number }>;

  // Analytics
  getDashboardStats(): Promise<any>;
  getReportsByReason(): Promise<any[]>;
  getReportsBySeverity(): Promise<any[]>;
}