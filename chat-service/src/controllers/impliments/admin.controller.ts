import { Request, Response } from "express";
import { IAdminService } from "../../services/interfaces/IAdminService";
import logger from "../../utils/logger.util";

export class AdminController {
  constructor(private readonly _adminService: IAdminService) {}

  async getHubs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as "asc" | "desc";

      const data = await this._adminService.getHubs({
        page,
        limit,
        search,
        sortBy,
        sortOrder
      });

      res.status(200).json({
        success: true,
        data: {
          hubs: data.hubs,
          total: data.total,
          page,
          limit,
          totalPages: Math.ceil(data.total / limit)
        }
      });
    } catch (error: unknown) {
      logger.error("AdminController.getHubs Error", { error });
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async getReportedHubs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const data = await this._adminService.getReportedHubs({ page, limit });

      res.status(200).json({
        success: true,
        data: {
          hubs: data.hubs,
          total: data.total,
          page,
          limit,
          totalPages: Math.ceil(data.total / limit)
        }
      });
    } catch (error: unknown) {
      logger.error("AdminController.getReportedHubs Error", { error });
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async suspendHub(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { suspended } = req.body;

      const result = await this._adminService.suspendHub(id, !!suspended);

      res.status(200).json({
        success: true,
        message: `Hub ${suspended ? "suspended" : "unsuspended"} successfully`,
        data: result
      });
    } catch (error: unknown) {
      logger.error("AdminController.suspendHub Error", { error });
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async deleteHub(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      await this._adminService.deleteHub(id);

      res.status(200).json({
        success: true,
        message: "Hub deleted successfully"
      });
    } catch (error: unknown) {
      logger.error("AdminController.deleteHub Error", { error });
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}
