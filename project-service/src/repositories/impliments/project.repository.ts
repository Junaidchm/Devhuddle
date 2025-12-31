import {
  IProjectRepository,
  ProjectSelectOptions,
  CreateProjectData,
} from "../interface/IProjectRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { Project, Prisma } from "@prisma/client";
import { userClient } from "../../config/grpc.client";
import { EnrichedProject } from "../../types/common.types";

export class ProjectRepository
  extends BaseRepository<
    typeof prisma.project,
    Project,
    Prisma.ProjectCreateInput,
    Prisma.ProjectUpdateInput,
    Prisma.ProjectWhereUniqueInput
  >
  implements IProjectRepository
{
  constructor() {
    super(prisma.project);
  }

  async createProject(data: CreateProjectData): Promise<Project> {
    try {
      const project = await prisma.$transaction(async (tx) => {
        // Validate media if provided
        if (data.mediaIds && data.mediaIds.length > 0) {
          const existingMedia = await tx.projectMedia.findMany({
            where: {
              id: { in: data.mediaIds },
            },
          });

          if (existingMedia.length !== data.mediaIds.length) {
            throw new Error("One or more media files not found");
          }

          const attachedMedia = existingMedia.filter((m) => m.projectId !== null);
          if (attachedMedia.length > 0) {
            throw new Error(
              "One or more media files are already attached to another project"
            );
          }
        }

        // Create project - auto-publish by default so it appears in listings
        const newProject = await tx.project.create({
          data: {
            title: data.title,
            description: data.description,
            userId: data.userId,
            repositoryUrls: data.repositoryUrls || [],
            demoUrl: data.demoUrl,
            techStack: data.techStack || [],
            tags: data.tags || [],
            visibility: (data.visibility as any) || "PUBLIC",
            status: (data.status as any) || "PUBLISHED", // Auto-publish so projects appear immediately
            publishedAt: new Date(), // Set publishedAt when creating
          },
          include: {
            media: true,
          },
        });

        // Attach media to project if provided
        if (data.mediaIds && data.mediaIds.length > 0) {
          await tx.projectMedia.updateMany({
            where: {
              id: { in: data.mediaIds },
              projectId: null, // Only update media that's not already attached
            },
            data: {
              projectId: newProject.id,
            },
          });
        }

        return newProject;
      }, {
        timeout: 10000,
        maxWait: 5000,
      });

      return project;
    } catch (error: any) {
      logger.error("Error creating project", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: data.userId,
      });
      throw new Error(error.message || "Database error");
    }
  }

  async updateProject(projectId: string, data: Partial<CreateProjectData>): Promise<Project> {
    try {
      const project = await prisma.$transaction(async (tx) => {
        const existingProject = await tx.project.findUnique({
          where: { id: projectId },
        });

        if (!existingProject) {
          throw new Error("Project not found");
        }

        // Create version snapshot before update
        await tx.projectVersion.create({
          data: {
            projectId: existingProject.id,
            version: existingProject.version,
            title: existingProject.title,
            description: existingProject.description,
            data: existingProject as any,
          },
        });

        // Update project
        const updatedProject = await tx.project.update({
          where: { id: projectId },
          data: {
            title: data.title,
            description: data.description,
            repositoryUrls: data.repositoryUrls,
            demoUrl: data.demoUrl,
            techStack: data.techStack,
            tags: data.tags,
            visibility: data.visibility as any,
            version: { increment: 1 },
            media:
              data.mediaIds && data.mediaIds.length > 0
                ? {
                    set: data.mediaIds.map((id) => ({ id })),
                  }
                : undefined,
          },
          include: {
            media: true,
          },
        });

        return updatedProject;
      });

      return project;
    } catch (error: any) {
      logger.error("Error updating project", {
        error: (error as Error).message,
        projectId,
      });
      throw new Error(error.message || "Database error");
    }
  }

  async getProjectById(projectId: string, userId?: string): Promise<EnrichedProject | null> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          media: {
            orderBy: { order: "asc" },
          },
          likes: userId
            ? {
                where: {
                  userId,
                  deletedAt: null,
                },
              }
            : false,
          shares: userId
            ? {
                where: {
                  userId,
                },
                take: 1,
              }
            : false,
          _count: {
            select: {
              likes: { where: { deletedAt: null } },
              comments: { where: { deletedAt: null } },
              shares: true,
            },
          },
        },
      });

      if (!project) {
        return null;
      }

      // Get user profile via gRPC
      let author = null;
      try {
        const userResponse = await new Promise((resolve, reject) => {
          userClient.getUserForFeedListing(
            { userId: project.userId },
            (error: any, response: any) => {
              if (error) reject(error);
              else resolve(response);
            }
          );
        });

        author = {
          id: project.userId,
          name: (userResponse as any).name,
          username: (userResponse as any).username,
          avatar: (userResponse as any).avatar || "",
        };
      } catch (error) {
        logger.error("Error fetching user profile", { error });
      }

      return {
        ...project,
        engagement: {
          likesCount: project._count.likes,
          commentsCount: project._count.comments,
          sharesCount: project._count.shares,
          viewsCount: project.viewsCount,
          isLiked: project.likes && project.likes.length > 0,
          isShared: project.shares && project.shares.length > 0,
        },
        author,
      };
    } catch (error: any) {
      logger.error("Error getting project", {
        error: (error as Error).message,
        projectId,
      });
      throw new Error("Database error");
    }
  }

  async listProjects(options: ProjectSelectOptions): Promise<EnrichedProject[]> {
    try {
      const projects = await prisma.project.findMany({
        ...options,
        where: {
          ...options.where,
          deletedAt: null,
          status: "PUBLISHED",
        },
        include: {
          media: {
            where: { isPreview: true },
            take: 1,
          },
          _count: {
            select: {
              likes: { where: { deletedAt: null } },
              comments: { where: { deletedAt: null } },
              shares: true,
            },
          },
        },
      });

      // Enrich with user profiles
      const enrichedProjects = await Promise.all(
        projects.map(async (project) => {
          let author = null;
          try {
            const userResponse = await new Promise((resolve, reject) => {
              userClient.getUserForFeedListing(
                { userId: project.userId },
                (error: any, response: any) => {
                  if (error) reject(error);
                  else resolve(response);
                }
              );
            });

            author = {
              id: project.userId,
              name: (userResponse as any).name,
              username: (userResponse as any).username,
              avatar: (userResponse as any).avatar || "",
            };
          } catch (error) {
            logger.error("Error fetching user profile", { error });
          }

          return {
            ...project,
            engagement: {
              likesCount: project._count.likes,
              commentsCount: project._count.comments,
              sharesCount: project._count.shares,
              viewsCount: project.viewsCount,
            },
            author,
          };
        })
      );

      return enrichedProjects;
    } catch (error: any) {
      logger.error("Error listing projects", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async getTrendingProjects(options: ProjectSelectOptions): Promise<EnrichedProject[]> {
    try {
      const projects = await prisma.project.findMany({
        ...options,
        where: {
          ...options.where,
          deletedAt: null,
          status: "PUBLISHED",
        },
        orderBy: {
          trendingScore: "desc",
        },
        include: {
          media: {
            where: { isPreview: true },
            take: 1,
          },
          _count: {
            select: {
              likes: { where: { deletedAt: null } },
              comments: { where: { deletedAt: null } },
              shares: true,
            },
          },
        },
      });

      return this.enrichProjectsWithUsers(projects);
    } catch (error: any) {
      logger.error("Error getting trending projects", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async getTopProjects(options: ProjectSelectOptions): Promise<EnrichedProject[]> {
    try {
      const projects = await prisma.project.findMany({
        ...options,
        where: {
          ...options.where,
          deletedAt: null,
          status: "PUBLISHED",
        },
        orderBy: [
          { likesCount: "desc" },
          { commentsCount: "desc" },
          { sharesCount: "desc" },
        ],
        include: {
          media: {
            where: { isPreview: true },
            take: 1,
          },
          _count: {
            select: {
              likes: { where: { deletedAt: null } },
              comments: { where: { deletedAt: null } },
              shares: true,
            },
          },
        },
      });

      return this.enrichProjectsWithUsers(projects);
    } catch (error: any) {
      logger.error("Error getting top projects", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async searchProjects(query: string, filters: any): Promise<EnrichedProject[]> {
    try {
      const projects = await prisma.project.findMany({
        where: {
          deletedAt: null,
          status: "PUBLISHED",
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { techStack: { hasSome: [query] } },
            { tags: { hasSome: [query] } },
          ],
          ...(filters.techStack && filters.techStack.length > 0
            ? { techStack: { hasSome: filters.techStack } }
            : {}),
          ...(filters.tags && filters.tags.length > 0
            ? { tags: { hasSome: filters.tags } }
            : {}),
        },
        take: filters.limit || 20,
        include: {
          media: {
            where: { isPreview: true },
            take: 1,
          },
          _count: {
            select: {
              likes: { where: { deletedAt: null } },
              comments: { where: { deletedAt: null } },
              shares: true,
            },
          },
        },
      });

      return this.enrichProjectsWithUsers(projects);
    } catch (error: any) {
      logger.error("Error searching projects", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async deleteProject(projectId: string, userId: string): Promise<Project> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new Error("Project not found");
      }

      if (project.userId !== userId) {
        throw new Error("Unauthorized");
      }

      const deletedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
          deletedAt: new Date(),
          status: "REMOVED",
        },
      });

      return deletedProject;
    } catch (error: any) {
      logger.error("Error deleting project", {
        error: (error as Error).message,
        projectId,
      });
      throw new Error(error.message || "Database error");
    }
  }

  async publishProject(projectId: string, userId: string): Promise<Project> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new Error("Project not found");
      }

      if (project.userId !== userId) {
        throw new Error("Unauthorized");
      }

      const publishedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      return publishedProject;
    } catch (error: any) {
      logger.error("Error publishing project", {
        error: (error as Error).message,
        projectId,
      });
      throw new Error(error.message || "Database error");
    }
  }

  async incrementViews(projectId: string): Promise<void> {
    try {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          viewsCount: { increment: 1 },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing views", {
        error: (error as Error).message,
        projectId,
      });
    }
  }

  async updateTrendingScore(projectId: string, score: number): Promise<void> {
    try {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          trendingScore: score,
        },
      });
    } catch (error: any) {
      logger.error("Error updating trending score", {
        error: (error as Error).message,
        projectId,
      });
    }
  }

  async findProject(projectId: string): Promise<Project | null> {
    try {
      return await prisma.project.findUnique({
        where: { id: projectId },
      });
    } catch (error: any) {
      logger.error("Error finding project", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  private async enrichProjectsWithUsers(projects: any[]): Promise<EnrichedProject[]> {
    return Promise.all(
      projects.map(async (project) => {
        let author = null;
        try {
          const userResponse = await new Promise((resolve, reject) => {
            userClient.getUserForFeedListing(
              { userId: project.userId },
              (error: any, response: any) => {
                if (error) reject(error);
                else resolve(response);
              }
            );
          });

          author = {
            id: project.userId,
            name: (userResponse as any).name,
            username: (userResponse as any).username,
            avatar: (userResponse as any).avatar || "",
          };
        } catch (error) {
          logger.error("Error fetching user profile", { error });
        }

        return {
          ...project,
          engagement: {
            likesCount: project._count.likes,
            commentsCount: project._count.comments,
            sharesCount: project._count.shares,
            viewsCount: project.viewsCount,
          },
          author,
        };
      })
    );
  }
}

