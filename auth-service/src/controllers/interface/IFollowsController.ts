import { Request, Response } from "express";

export interface IFollowsController {
  getSuggestions(req:Request,res:Response):Promise<void>
}