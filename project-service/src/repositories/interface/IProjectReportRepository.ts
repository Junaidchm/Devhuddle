import { ProjectReport, ReportReason, ReportStatus } from "@prisma/client";

export interface CreateProjectReportData {
  reporterId: string;
  projectId?: string;
  commentId?: string;
  reason: ReportReason;
  metadata?: any;
}

export interface IProjectReportRepository {
  createReport(data: CreateProjectReportData): Promise<ProjectReport>;
  findReport(reporterId: string, projectId?: string, commentId?: string): Promise<ProjectReport | null>;
  getReportsByProject(projectId: string): Promise<ProjectReport[]>;
  getReportsByComment(commentId: string): Promise<ProjectReport[]>;
  updateReportStatus(reportId: string, status: ReportStatus, resolvedBy?: string): Promise<ProjectReport>;
  getReportCount(projectId?: string, commentId?: string): Promise<number>;
}

