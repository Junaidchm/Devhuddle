import { Request, Response } from "express";

export interface IAdminController {
  // User Management
  getUsers(req: Request, res: Response): Promise<void>;
  getUserFullDetails(req: Request, res: Response): Promise<void>;
  toogleUserState(req: Request, res: Response): Promise<void>;

  // Reporting & Moderation
  submitReport(req: Request, res: Response): Promise<void>;
  getReports(req: Request, res: Response): Promise<void>;
  getReportById(req: Request, res: Response): Promise<void>;
  processReportAction(req: Request, res: Response): Promise<void>;
  bulkReportAction(req: Request, res: Response): Promise<void>;

  // Auditing
  getAuditLogs(req: Request, res: Response): Promise<void>;

  // Analytics
  getDashboardStats(req: Request, res: Response): Promise<void>;
  getReportsByReason(req: Request, res: Response): Promise<void>;
  getReportsBySeverity(req: Request, res: Response): Promise<void>;
}