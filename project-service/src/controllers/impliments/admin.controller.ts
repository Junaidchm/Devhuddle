import { Request, Response } from "express";
import { IAdminService } from "../../services/interfaces/IAdminService";
import { HttpStatus } from "../../constands/http.status";
import logger from "../../utils/logger.util";

export class AdminController {
  constructor(private readonly _adminService: IAdminService) {}

  async getProjects(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const userId = req.query.userId as string;
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as "asc" | "desc";

      const data = await this._adminService.getProjects({
        page,
        limit,
        status,
        userId,
        search,
        sortBy,
        sortOrder
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          projects: data.projects,
          total: data.total,
          page,
          limit,
          totalPages: Math.ceil(data.total / limit)
        }
      });
    } catch (error: unknown) {
      logger.error("AdminController.getProjects Error", { error });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
  }

  async getReportedProjects(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.query.userId as string;
      const search = req.query.search as string;

      const data = await this._adminService.getReportedProjects({ page, limit, userId, search });

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          projects: data.projects,
          total: data.total,
          page,
          limit,
          totalPages: Math.ceil(data.total / limit)
        }
      });
    } catch (error: unknown) {
      logger.error("AdminController.getReportedProjects Error", { error });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
  }

  async getProjectById(req: Request, res: Response) {
    try {
      const idParam = req.params.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!id) {
        res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Project ID is required" });
        return;
      }
      const project = await this._adminService.getProjectById(id);

      res.status(HttpStatus.OK).json({
        success: true,
        data: project,
      });
    } catch (error: unknown) {
      logger.error("AdminController.getProjectById Error", { error });
      const status = (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = (error as any)?.message || "Internal server error";
      res.status(status).json({ success: false, message });
    }
  }

  async hideProject(req: Request, res: Response) {
    try {
      const idParam = req.params.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!id) {
        res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Project ID is required" });
        return;
      }
      const { hidden, reason } = req.body;
      const adminId = (req as any).user?.id || "system";

      const result = await this._adminService.hideProject(id, !!hidden, reason, adminId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: `Project ${hidden ? "hidden" : "unhidden"} successfully`,
        data: result
      });
    } catch (error: unknown) {
      logger.error("AdminController.hideProject Error", { error });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
  }

  async deleteProject(req: Request, res: Response) {
    try {
      const idParam = req.params.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!id) {
        res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Project ID is required" });
        return;
      }

      const result = await this._adminService.deleteProject(id);

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project deleted successfully",
        data: result
      });
    } catch (error: unknown) {
      logger.error("AdminController.deleteProject Error", { error });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
  }
}
