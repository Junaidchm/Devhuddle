import { Request, Response } from "express";
import { IAdminService } from "../../services/interfaces/IAdminService";
import logger from "../../utils/logger.util";

export class AdminController {
  constructor(private readonly _adminService: IAdminService) {}

  async getHubs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as "asc" | "desc";

      const data = await this._adminService.getHubs({
        page,
        limit,
        status,
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
      const search = req.query.search as string;

      const data = await this._adminService.getReportedHubs({ page, limit, search });

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

  async getHubById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const hub = await this._adminService.getHubById(id);

      res.status(200).json({
        success: true,
        data: hub,
      });
    } catch (error: unknown) {
      logger.error("AdminController.getHubById Error", { error });
      const status = (error as any)?.statusCode || 500;
      const message = (error as any)?.message || "Internal server error";
      res.status(status).json({ success: false, message });
    }
  }

  async suspendHub(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { suspended, reason } = req.body;
      const adminId = (req as any).user?.id || (req as any).adminId;

      const result = await this._adminService.suspendHub(id, !!suspended, reason, adminId);

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
      const adminId = (req as any).user?.id || (req as any).adminId;

      await this._adminService.deleteHub(id, adminId);

      res.status(200).json({
        success: true,
        message: "Hub deleted successfully"
      });
    } catch (error: unknown) {
      logger.error("AdminController.deleteHub Error", { error });
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async getHubStats(call: any, callback: any) {
    try {
      const stats = await this._adminService.getHubStats();
      callback(null, {
        total_hubs: stats.totalHubs,
        reported_hubs: stats.reportedHubs,
        suspended_hubs: stats.suspendedHubs,
        deleted_hubs: stats.deletedHubs,
      });
    } catch (error: unknown) {
      logger.error("AdminController.getHubStats gRPC Error", { error });
      callback(error);
    }
  }
}
