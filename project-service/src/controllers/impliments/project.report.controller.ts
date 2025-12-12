import { Request, Response, NextFunction } from "express";
import { IProjectReportService } from "../../services/interfaces/IProjectReportService";
import { HttpStatus } from "../../constands/http.status";
import { getUserIdFromRequest } from "../../utils/request.util";

export class ProjectReportController {
  constructor(private reportService: IProjectReportService) {}

  async reportProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const reporterId = getUserIdFromRequest(req);
      const { reason, metadata } = req.body;

      // Validation handled by DTO

      const result = await this.reportService.reportProject({
        projectId,
        reporterId,
        reason,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project reported successfully",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

