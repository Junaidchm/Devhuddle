import prisma from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { BaseRepository } from "./base.repository";
import { Prisma, User, Report, AuditLog, ReportStatus, ReportTargetType, ReportSeverity } from "@prisma/client";

import { IAdminRepository } from "../interfaces/IAdminRepository";

export class AdminRepository extends BaseRepository<
  typeof prisma.user,
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput,
  Prisma.UserWhereUniqueInput
> implements IAdminRepository {
  constructor() {
    super(prisma.user);
  }

  async findManyPaginated(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    date?: string
  ): Promise<{ users: Partial<User>[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const where: Prisma.UserWhereInput = {
        NOT: { role: "superAdmin" },
      };

      if (status && status !== "all") {
        if (status === "active") where.isBlocked = false;
        else if (status === "inactive") {
          where.isBlocked = true;
        }
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
        ];
      }

      if (date && date !== "all") {
        const now = new Date();
        const fromDate = new Date();

        if (date === "today") {
          fromDate.setHours(0, 0, 0, 0);
        } else if (date === "last-week") {
          fromDate.setDate(now.getDate() - 7);
        } else if (date === "last-month") {
          fromDate.setDate(now.getDate() - 30);
        } else if (date === "last-quarter") {
          fromDate.setDate(now.getDate() - 90);
        }

        where.createdAt = { gte: fromDate };
      }

      const [users, total] = await Promise.all([
        this.model.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          where,
          select: {
            bio: true,
            company: true,
            createdAt: true,
            email: true,
            id: true,
            isBlocked: true,
            jobTitle: true,
            location: true,
            name: true,
            role: true,
            profilePicture: true,
            skills: true,
            yearsOfExperience: true,
            username: true,
            emailVerified: true,
          },
        }),
        this.model.count({ where }),
      ]);
      return { users, total };
    } catch (error: unknown) {
      logger.error("Error fetching paginated users", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async findUserFullDetails(userId: string): Promise<Partial<User> | null> {
    try {
      const user = await this.model.findUnique({
        where: { id: userId },
        select: {
          bio: true,
          company: true,
          createdAt: true,
          email: true,
          id: true,
          isBlocked: true,
          jobTitle: true,
          location: true,
          name: true,
          role: true,
          profilePicture: true,
          skills: true,
          yearsOfExperience: true,
          username: true,
          emailVerified: true,
        },
      });

      return user;
    } catch (error: unknown) {
      logger.error("Error fetching user full details", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async toogleUserBlock(
    userId: string
  ): Promise<{ id: string; isBlocked: boolean }> {
    try {
      const user = await super.findById(userId);
      const updatedUser = await this.model.update({
        where: { id: userId },
        data: { isBlocked: !user?.isBlocked },
        select: {
          id: true,
          isBlocked: true,
        },
      });
      return updatedUser;
    } catch (error: unknown) {
      logger.error("Error Toogling Block Unblock users", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  // Reporting implementation
  async createReport(data: Prisma.ReportCreateInput): Promise<Report> {
    return prisma.report.create({ data });
  }

  async findReports(params: {
    page: number;
    limit: number;
    status?: ReportStatus;
    targetType?: ReportTargetType;
    severity?: ReportSeverity;
  }): Promise<{ reports: Report[]; total: number }> {
    const { page, limit, status, targetType, severity } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.ReportWhereInput = {};

    if (status && (status as string) !== "all") where.status = status;
    if (targetType && (targetType as string) !== "all") where.targetType = targetType;
    if (severity && (severity as string) !== "all") where.severity = severity;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reporter: {
            select: { id: true, name: true, username: true }
          },
          reviewer: {
            select: { id: true, name: true, username: true }
          }
        }
      }),
      prisma.report.count({ where })
    ]);

    return { reports, total };
  }

  async findReportById(id: string): Promise<Report | null> {
    return prisma.report.findUnique({
      where: { id },
      include: {
        reporter: {
          select: { id: true, name: true, username: true }
        },
        reviewer: {
          select: { id: true, name: true, username: true }
        }
      }
    });
  }

  async updateReport(id: string, data: Prisma.ReportUpdateInput): Promise<Report> {
    return prisma.report.update({
      where: { id },
      data
    });
  }

  // Auditing implementation
  async createAuditLog(data: Prisma.AuditLogCreateInput): Promise<AuditLog> {
    return prisma.auditLog.create({ data });
  }

  async findAuditLogs(params: {
    page: number;
    limit: number;
    adminId?: string;
    targetType?: string;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const { page, limit, adminId, targetType } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (adminId) where.adminId = adminId;
    if (targetType) where.targetType = targetType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          admin: {
            select: { id: true, name: true, username: true }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    return { logs, total };
  }

  // Outbox implementation
  async createOutboxEvent(data: Prisma.OutboxEventCreateInput, tx?: Prisma.TransactionClient): Promise<any> {
    const client = tx || prisma;
    return (client as any).outboxEvent.create({ data });
  }

  // Phase 3: Analytics
  async getDashboardStats(): Promise<any> {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30);

    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      totalReports,
      pendingReports,
      investigatingReports,
      resolvedReports,
      criticalReports,
      highReports,
      reportsToday,
      reportsWeek,
      auditLogCount,
      systemStats,
    ] = await Promise.all([
      prisma.user.count({ where: { NOT: { role: "superAdmin" } } }),
      prisma.user.count({ where: { NOT: { role: "superAdmin" }, isBlocked: false } }),
      prisma.user.count({ where: { isBlocked: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.report.count(),
      prisma.report.count({ where: { status: "PENDING" } }),
      prisma.report.count({ where: { status: "INVESTIGATING" } }),
      prisma.report.count({ where: { status: { in: ["RESOLVED_APPROVED", "RESOLVED_REMOVED", "RESOLVED_IGNORED"] } } }),
      prisma.report.count({ where: { severity: "CRITICAL" } }),
      prisma.report.count({ where: { severity: "HIGH" } }),
      prisma.report.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.report.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.auditLog.count(),
      prisma.systemStats.findUnique({ where: { id: "global-stats" } }),
    ]);

    const stats = systemStats || {
      totalPosts: 0,
      totalComments: 0,
      totalLikes: 0,
      totalShares: 0
    };

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: blockedUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersWeek,
        newThisMonth: newUsersMonth,
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
        open: 0,
        investigating: investigatingReports,
        resolved: resolvedReports,
        critical: criticalReports,
        high: highReports,
        createdToday: reportsToday,
        createdThisWeek: reportsWeek,
      },
      auditLogs: {
        total: auditLogCount,
      },
      posts: { 
        total: stats.totalPosts, 
        reported: 0, 
        hidden: 0, 
        deleted: 0, 
        createdToday: 0, 
        createdThisWeek: 0, 
        createdThisMonth: 0 
      },
      comments: { 
        total: stats.totalComments, 
        reported: 0, 
        deleted: 0, 
        createdToday: 0 
      },
      projects: {
        total: (stats as any).totalProjects || 0,
        reported: 0,
        hidden: 0,
        deleted: 0
      },
      hubs: {
        total: (stats as any).totalHubs || 0,
        reported: 0,
        suspended: 0,
        deleted: 0
      },
      engagement: { 
        totalLikes: stats.totalLikes, 
        totalComments: stats.totalComments, 
        totalShares: stats.totalShares 
      },
    };
  }

  async getReportsByReason(): Promise<any[]> {
    const reports = await prisma.report.groupBy({
      by: ["reason"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });
    return reports.map(r => ({ reason: r.reason, count: r._count.id }));
  }

  async getReportsBySeverity(): Promise<any[]> {
    const reports = await prisma.report.groupBy({
      by: ["severity"],
      _count: { id: true },
    });
    return reports.map(r => ({ severity: r.severity, count: r._count.id }));
  }
}
