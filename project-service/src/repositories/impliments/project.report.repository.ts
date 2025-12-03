import { IProjectReportRepository, CreateProjectReportData } from "../interface/IProjectReportRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { ProjectReport, Prisma, ReportStatus } from "@prisma/client";
import logger from "../../utils/logger.util";

export class ProjectReportRepository
  extends BaseRepository<
    typeof prisma.projectReport,
    ProjectReport,
    Prisma.ProjectReportCreateInput,
    Prisma.ProjectReportUpdateInput,
    Prisma.ProjectReportWhereUniqueInput
  >
  implements IProjectReportRepository
{
  constructor() {
    super(prisma.projectReport);
  }

  async createReport(data: CreateProjectReportData): Promise<ProjectReport> {
    try {
      const report = await super.create({
        reporterId: data.reporterId,
        ...(data.projectId ? { Project: { connect: { id: data.projectId } } } : {}),
        ...(data.commentId ? { Comment: { connect: { id: data.commentId } } } : {}),
        reason: data.reason,
        metadata: data.metadata,
        status: ReportStatus.OPEN,
      });

      // Increment project reports count if reporting a project
      if (data.projectId) {
        await prisma.project.update({
          where: { id: data.projectId },
          data: {
            reportsCount: { increment: 1 },
          },
        });
      }

      return report;
    } catch (error: any) {
      logger.error("Error creating project report", { error: error.message });
      if (error.code === "P2002") {
        throw new Error("Report already exists");
      }
      throw new Error("Failed to create report");
    }
  }

  async findReport(
    reporterId: string,
    projectId?: string,
    commentId?: string
  ): Promise<ProjectReport | null> {
    try {
      return await prisma.projectReport.findFirst({
        where: {
          reporterId,
          projectId: projectId || null,
          commentId: commentId || null,
        },
      });
    } catch (error: any) {
      logger.error("Error finding project report", { error: error.message });
      throw new Error("Failed to find report");
    }
  }

  async getReportsByProject(projectId: string): Promise<ProjectReport[]> {
    try {
      return await prisma.projectReport.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting reports by project", { error: error.message });
      throw new Error("Failed to get reports by project");
    }
  }

  async getReportsByComment(commentId: string): Promise<ProjectReport[]> {
    try {
      return await prisma.projectReport.findMany({
        where: { commentId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting reports by comment", { error: error.message });
      throw new Error("Failed to get reports by comment");
    }
  }

  async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    resolvedBy?: string
  ): Promise<ProjectReport> {
    try {
      return await super.update(reportId, {
        status,
        resolvedAt: status === "CLOSED" || status === "RESOLVED" ? new Date() : undefined,
        resolvedBy,
      });
    } catch (error: any) {
      logger.error("Error updating report status", { error: error.message });
      throw new Error("Failed to update report status");
    }
  }

  async getReportCount(projectId?: string, commentId?: string): Promise<number> {
    try {
      const where: any = {};
      if (projectId) where.projectId = projectId;
      if (commentId) where.commentId = commentId;

      return await prisma.projectReport.count({ where });
    } catch (error: any) {
      logger.error("Error getting report count", { error: error.message });
      throw new Error("Failed to get report count");
    }
  }
}

