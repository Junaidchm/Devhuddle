import { Request, Response, NextFunction } from "express";

export interface IProjectSendController {
  sendProject(req: Request, res: Response, next: NextFunction): Promise<void>;
}
