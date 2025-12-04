import * as grpc from "@grpc/grpc-js";
import {
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  GetProjectRequest,
  GetProjectResponse,
  ListProjectsRequest,
  ListProjectsResponse,
  DeleteProjectRequest,
  DeleteProjectResponse,
  PublishProjectRequest,
  PublishProjectResponse,
  GetTrendingProjectsRequest,
  GetTrendingProjectsResponse,
  GetTopProjectsRequest,
  GetTopProjectsResponse,
  SearchProjectsRequest,
  SearchProjectsResponse,
  TrackProjectViewRequest,
  TrackProjectViewResponse,
  Project,
  ProjectEngagement,
  ProjectMedia,
  UserProfile,
} from "../../grpc/generated/project";
import { IProjectService } from "../interfaces/IProjectService";
import { IProjectRepository } from "../../repositories/interface/IProjectRepository";
import { IProjectLikeRepository } from "../../repositories/interface/IProjectLikeRepository";
import { IProjectShareRepository } from "../../repositories/interface/IProjectShareRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { OutboxAggregateType, OutboxEventType } from "@prisma/client";
import { calculateTrendingScore } from "../../utils/trending.util";

export class ProjectService implements IProjectService {
  constructor(
    private projectRepository: IProjectRepository,
    private likeRepository?: IProjectLikeRepository,
    private shareRepository?: IProjectShareRepository,
    private outboxService?: IOutboxService
  ) {}

  async createProject(req: CreateProjectRequest): Promise<CreateProjectResponse> {
    try {
      // Validation
      this.validateCreateProject(req);

      const project = await this.projectRepository.createProject({
        title: req.title,
        description: req.description,
        userId: req.userId,
        repositoryUrls: req.repositoryUrls || [],
        demoUrl: req.demoUrl || undefined,
        techStack: req.techStack || [],
        tags: req.tags || [],
        visibility: req.visibility || "PUBLIC",
        status: "PUBLISHED", // Auto-publish so projects appear immediately in listings
        mediaIds: req.mediaIds || [],
      });

      // Calculate initial trending score for published projects
      if (project.status === "PUBLISHED" && project.publishedAt) {
        const trendingScore = calculateTrendingScore(
          0, // likesCount
          0, // commentsCount
          0, // sharesCount
          0, // viewsCount
          project.publishedAt
        );
        await this.projectRepository.updateTrendingScore(project.id, trendingScore);
      }

      // Publish event
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT,
          aggregateId: project.id,
          type: OutboxEventType.PROJECT_CREATED,
          topic: KAFKA_TOPICS.PROJECT_CREATED,
          key: project.id,
          payload: {
            projectId: project.id,
            userId: project.userId,
            title: project.title,
            status: project.status,
            publishedAt: project.publishedAt?.toISOString() || "",
          },
        });
      }

      return {
        id: project.id,
        title: project.title,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
      };
    } catch (err: any) {
      logger.error("CreateProject error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async updateProject(req: UpdateProjectRequest): Promise<UpdateProjectResponse> {
    try {
      // Validate ownership
      const existingProject = await this.projectRepository.findProject(req.projectId);
      if (!existingProject) {
        throw new CustomError(grpc.status.NOT_FOUND, "Project not found");
      }
      if (existingProject.userId !== req.userId) {
        throw new CustomError(grpc.status.PERMISSION_DENIED, "Unauthorized");
      }

      // Validation
      if (req.title && (req.title.length < 3 || req.title.length > 200)) {
        throw new CustomError(grpc.status.INVALID_ARGUMENT, "Title must be 3-200 characters");
      }
      if (req.description && req.description.length > 10000) {
        throw new CustomError(grpc.status.INVALID_ARGUMENT, "Description too long (max 10000 characters)");
      }

      const updatedProject = await this.projectRepository.updateProject(req.projectId, {
        title: req.title,
        description: req.description,
        repositoryUrls: req.repositoryUrls,
        demoUrl: req.demoUrl,
        techStack: req.techStack,
        tags: req.tags,
        visibility: req.visibility,
        mediaIds: req.mediaIds,
      });

      // Publish event
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT,
          aggregateId: updatedProject.id,
          type: OutboxEventType.PROJECT_UPDATED,
          topic: KAFKA_TOPICS.PROJECT_UPDATED,
          key: updatedProject.id,
          payload: {
            projectId: updatedProject.id,
            userId: updatedProject.userId,
          },
        });
      }

      return {
        id: updatedProject.id,
        updatedAt: updatedProject.updatedAt.toISOString(),
      };
    } catch (err: any) {
      logger.error("UpdateProject error", { error: err.message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async getProject(req: GetProjectRequest): Promise<GetProjectResponse> {
    try {
      const project = await this.projectRepository.getProjectById(req.projectId, req.userId);

      if (!project) {
        throw new CustomError(grpc.status.NOT_FOUND, "Project not found");
      }

      // Check visibility
      if (project.visibility === "PRIVATE" && project.userId !== req.userId) {
        throw new CustomError(grpc.status.PERMISSION_DENIED, "Project is private");
      }

      // Track view (async, don't wait)
      this.projectRepository.incrementViews(req.projectId).catch((err) => {
        logger.error("Error tracking view", { error: err.message });
      });

      return {
        project: this.mapToProjectProto(project),
      };
    } catch (err: any) {
      logger.error("GetProject error", { error: err.message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async listProjects(req: ListProjectsRequest): Promise<ListProjectsResponse> {
    try {
      const PAGE_SIZE = req.limit || 10;
      const options: any = {
        take: PAGE_SIZE + 1,
        skip: req.pageParam ? 1 : 0,
        cursor: req.pageParam ? { id: req.pageParam } : undefined,
        orderBy: { createdAt: "desc" },
        where: {},
      };

      // Apply filters
      if (req.filter === "trending") {
        options.orderBy = { trendingScore: "desc" };
      } else if (req.filter === "top") {
        options.orderBy = [
          { likesCount: "desc" },
          { commentsCount: "desc" },
          { sharesCount: "desc" },
        ];
      }

      if (req.techStack && req.techStack.length > 0) {
        options.where.techStack = { hasSome: req.techStack };
      }
      if (req.tags && req.tags.length > 0) {
        options.where.tags = { hasSome: req.tags };
      }

      const projects = await this.projectRepository.listProjects(options);
      const hasMore = projects.length > PAGE_SIZE;
      const items = projects.slice(0, PAGE_SIZE);

      // Get user engagement status
      let userLikesMap: Record<string, boolean> = {};
      let userSharesMap: Record<string, boolean> = {};

      if (req.userId && items.length > 0) {
        const projectIds = items.map((p: any) => p.id);
        userLikesMap =
          (await this.likeRepository?.getUserLikesForProjects(req.userId, projectIds)) || {};
        userSharesMap =
          (await this.shareRepository?.getUserSharesForProjects(req.userId, projectIds)) || {};
      }

      const enrichedProjects = items.map((project: any) => ({
        ...this.mapToProjectProto(project),
        engagement: {
          ...project.engagement,
          isLiked: userLikesMap[project.id] || false,
          isShared: userSharesMap[project.id] || false,
        },
      }));

      const nextCursor = hasMore ? enrichedProjects[enrichedProjects.length - 1].id : null;

      return {
        projects: enrichedProjects,
        nextCursor: nextCursor || undefined,
        totalCount: enrichedProjects.length,
      };
    } catch (err: any) {
      logger.error("ListProjects error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async deleteProject(req: DeleteProjectRequest): Promise<DeleteProjectResponse> {
    try {
      const project = await this.projectRepository.deleteProject(req.projectId, req.userId);

      // Publish event
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT,
          aggregateId: req.projectId,
          type: OutboxEventType.PROJECT_DELETED,
          topic: KAFKA_TOPICS.PROJECT_DELETED,
          key: req.projectId,
          payload: {
            projectId: req.projectId,
            userId: req.userId,
          },
        });
      }

      return {
        id: project.id,
        success: true,
      };
    } catch (err: any) {
      logger.error("DeleteProject error", { error: err.message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async publishProject(req: PublishProjectRequest): Promise<PublishProjectResponse> {
    try {
      const project = await this.projectRepository.publishProject(req.projectId, req.userId);

      // Calculate initial trending score
      const trendingScore = calculateTrendingScore(
        project.likesCount,
        project.commentsCount,
        project.sharesCount,
        project.viewsCount,
        project.publishedAt
      );
      await this.projectRepository.updateTrendingScore(req.projectId, trendingScore);

      // Publish event
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT,
          aggregateId: req.projectId,
          type: OutboxEventType.PROJECT_PUBLISHED,
          topic: KAFKA_TOPICS.PROJECT_PUBLISHED,
          key: req.projectId,
          payload: {
            projectId: req.projectId,
            userId: req.userId,
            publishedAt: project.publishedAt?.toISOString(),
          },
        });
      }

      return {
        id: project.id,
        status: project.status,
        publishedAt: project.publishedAt?.toISOString() || "",
      };
    } catch (err: any) {
      logger.error("PublishProject error", { error: err.message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async getTrendingProjects(req: GetTrendingProjectsRequest): Promise<GetTrendingProjectsResponse> {
    try {
      const PAGE_SIZE = req.limit || 10;
      const options: any = {
        take: PAGE_SIZE + 1,
        skip: req.pageParam ? 1 : 0,
        cursor: req.pageParam ? { id: req.pageParam } : undefined,
        orderBy: { trendingScore: "desc" },
        where: {},
      };

      const projects = await this.projectRepository.getTrendingProjects(options);
      const hasMore = projects.length > PAGE_SIZE;
      const items = projects.slice(0, PAGE_SIZE);

      // Get user engagement status
      let userLikesMap: Record<string, boolean> = {};
      let userSharesMap: Record<string, boolean> = {};

      if (req.userId && items.length > 0) {
        const projectIds = items.map((p: any) => p.id);
        userLikesMap =
          (await this.likeRepository?.getUserLikesForProjects(req.userId, projectIds)) || {};
        userSharesMap =
          (await this.shareRepository?.getUserSharesForProjects(req.userId, projectIds)) || {};
      }

      const enrichedProjects = items.map((project: any) => ({
        ...this.mapToProjectProto(project),
        engagement: {
          ...project.engagement,
          isLiked: userLikesMap[project.id] || false,
          isShared: userSharesMap[project.id] || false,
        },
      }));

      const nextCursor = hasMore ? enrichedProjects[enrichedProjects.length - 1].id : null;

      return {
        projects: enrichedProjects,
        nextCursor: nextCursor || undefined,
      };
    } catch (err: any) {
      logger.error("GetTrendingProjects error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async getTopProjects(req: GetTopProjectsRequest): Promise<GetTopProjectsResponse> {
    try {
      const PAGE_SIZE = req.limit || 10;
      const options: any = {
        take: PAGE_SIZE + 1,
        skip: req.pageParam ? 1 : 0,
        cursor: req.pageParam ? { id: req.pageParam } : undefined,
        where: {},
      };

      const projects = await this.projectRepository.getTopProjects(options);
      const hasMore = projects.length > PAGE_SIZE;
      const items = projects.slice(0, PAGE_SIZE);

      // Get user engagement status
      let userLikesMap: Record<string, boolean> = {};
      let userSharesMap: Record<string, boolean> = {};

      if (req.userId && items.length > 0) {
        const projectIds = items.map((p: any) => p.id);
        userLikesMap =
          (await this.likeRepository?.getUserLikesForProjects(req.userId, projectIds)) || {};
        userSharesMap =
          (await this.shareRepository?.getUserSharesForProjects(req.userId, projectIds)) || {};
      }

      const enrichedProjects = items.map((project: any) => ({
        ...this.mapToProjectProto(project),
        engagement: {
          ...project.engagement,
          isLiked: userLikesMap[project.id] || false,
          isShared: userSharesMap[project.id] || false,
        },
      }));

      const nextCursor = hasMore ? enrichedProjects[enrichedProjects.length - 1].id : null;

      return {
        projects: enrichedProjects,
        nextCursor: nextCursor || undefined,
      };
    } catch (err: any) {
      logger.error("GetTopProjects error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async searchProjects(req: SearchProjectsRequest): Promise<SearchProjectsResponse> {
    try {
      const projects = await this.projectRepository.searchProjects(req.query, {
        techStack: req.techStack || [],
        tags: req.tags || [],
        limit: req.limit || 20,
      });

      // Get user engagement status
      let userLikesMap: Record<string, boolean> = {};
      let userSharesMap: Record<string, boolean> = {};

      if (req.userId && projects.length > 0) {
        const projectIds = projects.map((p: any) => p.id);
        userLikesMap =
          (await this.likeRepository?.getUserLikesForProjects(req.userId, projectIds)) || {};
        userSharesMap =
          (await this.shareRepository?.getUserSharesForProjects(req.userId, projectIds)) || {};
      }

      const enrichedProjects = projects.map((project: any) => ({
        ...this.mapToProjectProto(project),
        engagement: {
          ...project.engagement,
          isLiked: userLikesMap[project.id] || false,
          isShared: userSharesMap[project.id] || false,
        },
      }));

      return {
        projects: enrichedProjects,
        totalCount: enrichedProjects.length,
      };
    } catch (err: any) {
      logger.error("SearchProjects error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async trackProjectView(req: TrackProjectViewRequest): Promise<TrackProjectViewResponse> {
    try {
      await this.projectRepository.incrementViews(req.projectId);
      const project = await this.projectRepository.findProject(req.projectId);
      
      return {
        success: true,
        viewsCount: project?.viewsCount || 0,
      };
    } catch (err: any) {
      logger.error("TrackProjectView error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  private validateCreateProject(req: CreateProjectRequest): void {
    if (!req.title || req.title.length < 3 || req.title.length > 200) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Title must be 3-200 characters");
    }
    if (!req.description || req.description.length === 0) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Description is required");
    }
    if (req.description.length > 10000) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Description too long (max 10000 characters)");
    }
    if (req.repositoryUrls && req.repositoryUrls.length > 5) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Maximum 5 repository URLs allowed");
    }
    if (req.techStack && req.techStack.length > 20) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Maximum 20 tech stack items allowed");
    }
    if (req.tags && req.tags.length > 10) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Maximum 10 tags allowed");
    }
    if (req.mediaIds && req.mediaIds.length > 10) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Maximum 10 media files allowed");
    }
  }

  private mapToProjectProto(project: any): Project {
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      userId: project.userId,
      repositoryUrls: project.repositoryUrls || [],
      demoUrl: project.demoUrl || undefined,
      techStack: project.techStack || [],
      tags: project.tags || [],
      visibility: project.visibility,
      status: project.status,
      engagement: {
        likesCount: project.engagement?.likesCount || 0,
        commentsCount: project.engagement?.commentsCount || 0,
        sharesCount: project.engagement?.sharesCount || 0,
        viewsCount: project.engagement?.viewsCount || 0,
        isLiked: project.engagement?.isLiked || false,
        isShared: project.engagement?.isShared || false,
      } as ProjectEngagement,
      media: (project.media || []).map((m: any) => ({
        id: m.id,
        type: m.type,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl || undefined,
        order: m.order,
        isPreview: m.isPreview,
        width: m.width || undefined,
        height: m.height || undefined,
        duration: m.duration || undefined,
      })) as ProjectMedia[],
      author: project.author ? {
        id: project.author.id,
        name: project.author.name,
        username: project.author.username,
        avatar: project.author.avatar,
      } as UserProfile : undefined as any,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      publishedAt: project.publishedAt?.toISOString() || undefined,
      trendingScore: project.trendingScore || 0,
    };
  }
}

