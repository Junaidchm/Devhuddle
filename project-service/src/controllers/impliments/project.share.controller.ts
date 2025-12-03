import { Request, Response, NextFunction } from "express";
import { IProjectShareService } from "../../services/interfaces/IProjectShareService";
import { HttpStatus } from "../../constands/http.status";
import { getUserIdFromRequest } from "../../utils/request.util";

export class ProjectShareController {
  constructor(private shareService: IProjectShareService) {}

  async shareProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromRequest(req);
      const { caption, shareType } = req.body;

      const result = await this.shareService.shareProject({
        projectId,
        userId,
        caption,
        shareType: shareType || "SHARE",
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project shared successfully",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

