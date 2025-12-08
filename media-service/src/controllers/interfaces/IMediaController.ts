import { Request, Response } from "express";

export interface IMediaController {
  createUploadSession(req: Request, res: Response): Promise<void>;
  completeUpload(req: Request, res: Response): Promise<void>;
  getMediaById(req: Request, res: Response): Promise<void>;
  deleteMedia(req: Request, res: Response): Promise<void>;
  getUserMedia(req: Request, res: Response): Promise<void>;
  validateMediaOwnership(req: Request, res: Response): Promise<void>;
  linkMediaToPost(req: Request, res: Response): Promise<void>;
}

