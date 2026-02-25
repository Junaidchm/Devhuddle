import { IAdminService, GetProjectsParams } from "../interfaces/IAdminService";
import { IProjectRepository, ProjectSelectOptions } from "../../repositories/interface/IProjectRepository";
import { IProjectReportRepository } from "../../repositories/interface/IProjectReportRepository";
import { EnrichedProject } from "../../types/common.types";
import { Project, ProjectStatus, Prisma } from "@prisma/client";
import { adminAuthClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.util";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import CIRCUIT_BREAKER from "opossum";
import { fetchProjectMedia } from "../../config/media.client";
import { createCircuitBreaker } from "../../utils/circuit.breaker.util";

export class AdminService implements IAdminService {
  constructor(
    private readonly _projectRepository: IProjectRepository,
    private readonly _reportRepository: IProjectReportRepository
  ) {}

  private _mediaBreaker = createCircuitBreaker(fetchProjectMedia, "MediaService:fetchProjectMedia", {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
  });

  async getProjects(params: GetProjectsParams): Promise<{ projects: EnrichedProject[]; total: number }> {
    try {
      const { page, limit, status, userId, search, sortBy, sortOrder } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ProjectWhereInput = {};

      if (status && status !== "all") {
        where.status = status.toUpperCase() as any;
      }

      if (userId) {
        where.userId = userId;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { userId: { contains: search, mode: "insensitive" } },
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

  async getReportedProjects(params: { page: number; limit: number; userId?: string; search?: string }): Promise<{ projects: EnrichedProject[]; total: number }> {
    try {
      const { page, limit, userId, search } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ProjectWhereInput = {
        reportsCount: { gt: 0 },
      };

      if (userId) {
        where.userId = userId;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { userId: { contains: search, mode: "insensitive" } },
        ];
      }

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

  async getProjectById(projectId: string): Promise<EnrichedProject> {
    try {
      const project = await this._projectRepository.getProjectById(projectId);
      if (!project) {
        throw new CustomError(404, "Project not found");
      }

      // Fetch media from Media Service (Resiliently)
      let mediaItems: any[] = [];
      try {
        mediaItems = await this._mediaBreaker.fire(projectId);
      } catch (mediaError: any) {
        logger.warn("Failed to fetch media from Media Service for project in Admin service", {
          projectId,
          error: mediaError.message
        });
      }

      const attachments = (mediaItems || []).map((media: any) => ({
          id: media.id,
          type: String(media.mediaType || "IMAGE").replace("PROJECT_", ""),
          url: media.cdnUrl || media.originalUrl,
          thumbnailUrl: media.thumbnailUrls?.[0] || media.cdnUrl || media.originalUrl,
          order: 0,
          isPreview: false,
          processingStatus: (media.status || "COMPLETED") as any,
          createdAt: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: media.updatedAt ? new Date(media.updatedAt).toISOString() : new Date().toISOString(),
      }));

      return {
        ...project,
        media: attachments as any,
      };
    } catch (error: unknown) {
      logger.error("Error in AdminService.getProjectById", { error });
      throw error;
    }
  }

  async hideProject(projectId: string, hide: boolean, reason?: string, adminId?: string): Promise<Project> {
    try {
      const status = hide ? ProjectStatus.REMOVED : ProjectStatus.PUBLISHED;
      const updatedProject = await this._projectRepository.updateProject(projectId, { status });

      // Emit Kafka event for notification
      if (updatedProject) {
        const { publishEvent } = await import("../../utils/kafka.util");
        const { KAFKA_TOPICS } = await import("../../config/kafka.config");
        
        await publishEvent(KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, {
          targetId: projectId,
          targetType: "PROJECT",
          ownerId: updatedProject.userId,
          action: hide ? "HIDE" : "UNHIDE",
          reason: reason || (hide ? "Moderation action" : "Content restored"),
          adminId: adminId || "system",
          timestamp: new Date().toISOString(),
          version: Date.now(),
        });

        // Audit the action in auth-service
        try {
          await grpcs(adminAuthClient, "createAuditLog", {
            adminId: adminId || "system",
            action: hide ? "PROJECT_HIDDEN" : "PROJECT_UNHIDDEN",
            targetType: "PROJECT",
            targetId: projectId,
            reason: reason || (hide ? "Moderation action" : "Content restored"),
            metadata: JSON.stringify({ userId: updatedProject.userId }),
          });
        } catch (auditError) {
          logger.error("Failed to create audit log for project hide/unhide", { error: auditError });
        }
      }

      return updatedProject;
    } catch (error: unknown) {
      logger.error("Error in AdminService.hideProject", { error });
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<Project> {
    try {
      const deletedProject = await this._projectRepository.updateProject(projectId, { 
        status: ProjectStatus.REMOVED,
        // We don't have a specific 'deletedAt' field in CreateProjectData but repo handles it
      });

      // Emit Kafka event for notification
      if (deletedProject) {
        const { publishEvent } = await import("../../utils/kafka.util");
        const { KAFKA_TOPICS } = await import("../../config/kafka.config");
        
        await publishEvent(KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, {
          targetId: projectId,
          targetType: "PROJECT",
          ownerId: deletedProject.userId,
          action: "DELETE",
          reason: "Permanent deletion",
          adminId: "system",
          timestamp: new Date().toISOString(),
          version: Date.now(),
        });

        // Audit the action in auth-service
        try {
          await grpcs(adminAuthClient, "createAuditLog", {
            adminId: "system", // Assuming system initiated delete if no adminId is passed
            action: "PROJECT_DELETED",
            targetType: "PROJECT",
            targetId: projectId,
            reason: "Permanent deletion",
            metadata: JSON.stringify({ userId: deletedProject.userId }),
          });
        } catch (auditError) {
          logger.error("Failed to create audit log for project delete", { error: auditError });
        }
      }

      return deletedProject;
    } catch (error: unknown) {
      logger.error("Error in AdminService.deleteProject", { error });
      throw error;
    }
  }
}
