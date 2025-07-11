import { Request, Response } from "express";

export interface IAdminController {
  getUsers(req: Request, res: Response): Promise<void>;

  getUserFullDetails(req: Request, res: Response): Promise<void>;

  toogleUserState(req: Request, res: Response): Promise<void>;
}