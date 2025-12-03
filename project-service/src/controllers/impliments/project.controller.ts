import { Request, Response, NextFunction } from "express";
import { IProjectService } from "../../services/interfaces/IProjectService";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import logger from "../../utils/logger.util";
import { getUserIdFromRequest } from "../../utils/request.util";

export class ProjectController {
  constructor(private projectService: IProjectService) {}

  async createProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = getUserIdFromRequest(req);
      const {
        title,
        description,
        repositoryUrls,
        demoUrl,
        techStack,
        tags,
        visibility,
        mediaIds,
      } = req.body;

      const result = await this.projectService.createProject({
        userId,
        title,
        description,
        repositoryUrls: repositoryUrls || [],
        demoUrl,
        techStack: techStack || [],
        tags: tags || [],
        visibility: visibility || "PUBLIC",
        mediaIds: mediaIds || [],
      });

      res.status(HttpStatus.CREATED).json({
        success: true,
        message: "Project created successfully",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async updateProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromRequest(req);
      const {
        title,
        description,
        repositoryUrls,
        demoUrl,
        techStack,
        tags,
        visibility,
        mediaIds,
      } = req.body;

      const result = await this.projectService.updateProject({
        projectId,
        userId,
        title,
        description,
        repositoryUrls,
        demoUrl,
        techStack,
        tags,
        visibility,
        mediaIds,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project updated successfully",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.headers["x-user-data"]
        ? getUserIdFromRequest(req)
        : undefined;

      const result = await this.projectService.getProject({
        projectId,
        userId,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          project: result.project,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async listProjects(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.headers["x-user-data"]
        ? getUserIdFromRequest(req)
        : undefined;
      const { pageParam, filter, techStack, tags, period, limit } = req.query;

      const result = await this.projectService.listProjects({
        pageParam: pageParam as string | undefined,
        userId,
        filter: filter as string | undefined,
        techStack: techStack
          ? (Array.isArray(techStack) ? techStack.map(String) : [String(techStack)])
          : [],
        tags: tags ? (Array.isArray(tags) ? tags.map(String) : [String(tags)]) : [],
        period: period as string | undefined,
        limit: limit ? parseInt(limit as string) : 10,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async deleteProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromRequest(req);

      const result = await this.projectService.deleteProject({
        projectId,
        userId,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project deleted successfully",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async publishProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromRequest(req);

      const result = await this.projectService.publishProject({
        projectId,
        userId,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project published successfully",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getTrendingProjects(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.headers["x-user-data"]
        ? getUserIdFromRequest(req)
        : undefined;
      const { pageParam, period, limit } = req.query;

      const result = await this.projectService.getTrendingProjects({
        pageParam: pageParam as string | undefined,
        userId,
        limit: limit ? parseInt(limit as string) : 10,
        period: period as string | undefined,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getTopProjects(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.headers["x-user-data"]
        ? getUserIdFromRequest(req)
        : undefined;
      const { pageParam, period, limit } = req.query;

      const result = await this.projectService.getTopProjects({
        pageParam: pageParam as string | undefined,
        userId,
        limit: limit ? parseInt(limit as string) : 10,
        period: period as string | undefined,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async searchProjects(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.headers["x-user-data"]
        ? getUserIdFromRequest(req)
        : undefined;
      const { query, pageParam, techStack, tags, limit } = req.query;

      if (!query) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          "Search query is required"
        );
      }

      const result = await this.projectService.searchProjects({
        query: query as string,
        pageParam: pageParam as string | undefined,
        userId,
        techStack: techStack
          ? (Array.isArray(techStack) ? techStack.map(String) : [String(techStack)])
          : [],
        tags: tags ? (Array.isArray(tags) ? tags.map(String) : [String(tags)]) : [],
        limit: limit ? parseInt(limit as string) : 20,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async trackProjectView(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.headers["x-user-data"]
        ? getUserIdFromRequest(req)
        : undefined;

      const result = await this.projectService.trackProjectView({
        projectId,
        userId,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

