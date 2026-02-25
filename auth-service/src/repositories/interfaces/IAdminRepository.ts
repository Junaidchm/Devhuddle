import { User, Report, AuditLog, ReportStatus, ReportTargetType, ReportReason, ReportSeverity, Prisma } from "@prisma/client";

export interface IAdminRepository {
  // User Management
  findManyPaginated(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    date?: string
  ): Promise<{ users: Partial<User>[]; total: number }>;

  findUserFullDetails(userId: string): Promise<Partial<User> | null>;

  toogleUserBlock(userId: string): Promise<{ id: string; isBlocked: boolean }>;

  findById(id: string): Promise<User | null>;

  // Reporting System
  createReport(data: Prisma.ReportCreateInput): Promise<Report>;
  
  findReports(params: {
    page: number;
    limit: number;
    status?: ReportStatus;
    targetType?: ReportTargetType;
    severity?: ReportSeverity;
    reason?: ReportReason;
    search?: string;
    sortBy?: "createdAt" | "severity" | "status";
    sortOrder?: "asc" | "desc";
  }): Promise<{ reports: Report[]; total: number }>;

  findReportById(id: string): Promise<Report | null>;

  updateReport(id: string, data: Prisma.ReportUpdateInput): Promise<Report>;

  // Audit System
  createAuditLog(data: Prisma.AuditLogCreateInput): Promise<AuditLog>;
  
  findAuditLogs(params: {
    page: number;
    limit: number;
    adminId?: string;
    targetType?: string;
    search?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ logs: AuditLog[]; total: number }>;

  // Outbox System
  createOutboxEvent(data: Prisma.OutboxEventCreateInput, tx?: Prisma.TransactionClient): Promise<any>;

  // Analytics
  getDashboardStats(): Promise<any>;
  getReportsByReason(): Promise<any[]>;
  getReportsBySeverity(): Promise<any[]>;
}
