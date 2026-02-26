import { Request, Response, NextFunction } from "express";
import { IProjectSendController } from "../interfaces/IProjectSendController";
import { IProjectSendService } from "../../services/interfaces/IProjectSendService";
import { HttpStatus } from "../../constands/http.status";
import { getUserIdFromRequest } from "../../utils/request.util";

export class ProjectSendController implements IProjectSendController {
  constructor(private _projectSendService: IProjectSendService) {}

  async sendProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const { recipientIds, message } = req.body;
      const senderId = getUserIdFromRequest(req);

      if (!senderId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!projectId) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "Project ID is required",
        });
        return;
      }

      const result = await this._projectSendService.sendProject(
        projectId as string,
        senderId,
        recipientIds,
        message
      );

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project sent successfully",
        data: result,
      });
    } catch (error: unknown) {
      next(error);
    }
  }
}
