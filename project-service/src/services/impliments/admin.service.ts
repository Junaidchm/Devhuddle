import { IAdminService, GetProjectsParams } from "../interfaces/IAdminService";
import { IProjectRepository, ProjectSelectOptions } from "../../repositories/interface/IProjectRepository";
import { IProjectReportRepository } from "../../repositories/interface/IProjectReportRepository";
import { EnrichedProject } from "../../types/common.types";
import { Project, ProjectStatus, Prisma } from "@prisma/client";
import logger from "../../utils/logger.util";

export class AdminService implements IAdminService {
  constructor(
    private readonly _projectRepository: IProjectRepository,
    private readonly _reportRepository: IProjectReportRepository
  ) {}

  async getProjects(params: GetProjectsParams): Promise<{ projects: EnrichedProject[]; total: number }> {
    try {
      const { page, limit, status, search, sortBy, sortOrder } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ProjectWhereInput = {};

      if (status && status !== "all") {
        where.status = status.toUpperCase() as any;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const options: ProjectSelectOptions = {
        skip,
        take: limit,
        where,
        orderBy: sortBy ? { [sortBy]: sortOrder || "desc" } : { createdAt: "desc" },
      };

      const [projects, total] = await Promise.all([
        this._projectRepository.adminListProjects(options),
        this._projectRepository.getProjectCount(where),
      ]);

      return { projects, total };
    } catch (error: unknown) {
      logger.error("Error in AdminService.getProjects", { error });
      throw error;
    }
  }

  async getReportedProjects(params: { page: number; limit: number }): Promise<{ projects: EnrichedProject[]; total: number }> {
    try {
      const { page, limit } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ProjectWhereInput = {
        reportsCount: { gt: 0 },
      };

      const options: ProjectSelectOptions = {
        skip,
        take: limit,
        where,
        orderBy: { reportsCount: "desc" },
      };

      const [projects, total] = await Promise.all([
        this._projectRepository.adminListProjects(options),
        this._projectRepository.getProjectCount(where),
      ]);

      return { projects, total };
    } catch (error: unknown) {
      logger.error("Error in AdminService.getReportedProjects", { error });
      throw error;
    }
  }

  async hideProject(projectId: string, hide: boolean): Promise<Project> {
    try {
      const status = hide ? ProjectStatus.REMOVED : ProjectStatus.PUBLISHED;
      // Note: Visibility and status are related but different in this schema.
      // status=REMOVED is used for moderation.
      return await this._projectRepository.updateProject(projectId, { status });
    } catch (error: unknown) {
      logger.error("Error in AdminService.hideProject", { error });
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<Project> {
    try {
      return await this._projectRepository.updateProject(projectId, { 
        status: ProjectStatus.REMOVED,
        // We don't have a specific 'deletedAt' field in CreateProjectData but repo handles it
      });
    } catch (error: unknown) {
      logger.error("Error in AdminService.deleteProject", { error });
      throw error;
    }
  }
}
