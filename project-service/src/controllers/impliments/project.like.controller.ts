import { Request, Response, NextFunction } from "express";
import { IProjectLikeService } from "../../services/interfaces/IProjectLikeService";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import { getUserIdFromRequest } from "../../utils/request.util";

export class ProjectLikeController {
  constructor(private _likeService: IProjectLikeService) {}

  async likeProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromRequest(req);

      const result = await this._likeService.likeProject({
        projectId: projectId as string,
        userId,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project liked successfully",
        data: result,
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async unlikeProject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromRequest(req);

      const result = await this._likeService.unlikeProject({
        projectId: projectId as string,
        userId,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Project unliked successfully",
        data: result,
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  async getLikeCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const count = await this._likeService.getLikeCount(projectId as string);

      res.status(HttpStatus.OK).json({
        success: true,
        count,
      });
    } catch (error: unknown) {
      next(error);
    }
  }
}

