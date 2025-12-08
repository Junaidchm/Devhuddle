import { Request, Response } from "express";
import { IMediaController } from "../interfaces/IMediaController";
import { IMediaService } from "../../services/interfaces/IMediaService";
import { sendErrorResponse } from "../../utils/error.util";
import logger from "../../utils/logger.util";

export class MediaController implements IMediaController {
  constructor(private mediaService: IMediaService) {}

  async createUploadSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      
      if (!userId) {
        return sendErrorResponse(res, {
          status: 401,
          message: "Unauthorized",
        });
      }

      const { fileName, fileType, fileSize, mediaType } = req.body;

      if (!fileName || !fileType || !fileSize || !mediaType) {
        return sendErrorResponse(res, {
          status: 400,
          message: "Missing required fields: fileName, fileType, fileSize, mediaType",
        });
      }

      const result = await this.mediaService.createUploadSession({
        userId,
        fileName,
        fileType,
        fileSize: parseInt(fileSize, 10),
        mediaType,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in createUploadSession", {
        error: error.message,
        stack: error.stack,
      });
      sendErrorResponse(res, error);
    }
  }

  async completeUpload(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { mediaId } = req.params;

      if (!userId) {
        return sendErrorResponse(res, {
          status: 401,
          message: "Unauthorized",
        });
      }

      if (!mediaId) {
        return sendErrorResponse(res, {
          status: 400,
          message: "Missing mediaId",
        });
      }

      const result = await this.mediaService.completeUpload({
        mediaId,
        userId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in completeUpload", {
        error: error.message,
        stack: error.stack,
      });
      sendErrorResponse(res, error);
    }
  }

  async getMediaById(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { mediaId } = req.params;

      if (!userId) {
        return sendErrorResponse(res, {
          status: 401,
          message: "Unauthorized",
        });
      }

      if (!mediaId) {
        return sendErrorResponse(res, {
          status: 400,
          message: "Missing mediaId",
        });
      }

      const media = await this.mediaService.getMediaById(mediaId, userId);

      res.status(200).json({
        success: true,
        data: media,
      });
    } catch (error: any) {
      logger.error("Error in getMediaById", {
        error: error.message,
        stack: error.stack,
      });
      sendErrorResponse(res, error);
    }
  }

  async deleteMedia(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { mediaId } = req.params;

      if (!userId) {
        return sendErrorResponse(res, {
          status: 401,
          message: "Unauthorized",
        });
      }

      if (!mediaId) {
        return sendErrorResponse(res, {
          status: 400,
          message: "Missing mediaId",
        });
      }

      await this.mediaService.deleteMedia(mediaId, userId);

      res.status(200).json({
        success: true,
        message: "Media deleted successfully",
      });
    } catch (error: any) {
      logger.error("Error in deleteMedia", {
        error: error.message,
        stack: error.stack,
      });
      sendErrorResponse(res, error);
    }
  }

  async getUserMedia(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        return sendErrorResponse(res, {
          status: 401,
          message: "Unauthorized",
        });
      }

      // This would need to be added to IMediaService
      // For now, we'll return a placeholder
      res.status(200).json({
        success: true,
        data: [],
        message: "Feature coming soon",
      });
    } catch (error: any) {
      logger.error("Error in getUserMedia", {
        error: error.message,
        stack: error.stack,
      });
      sendErrorResponse(res, error);
    }
  }

  /**
   * Validate media ownership (called by Post Service)
   * 
   * Why this endpoint exists:
   * - Post Service needs to verify media belongs to user before creating post
   * - Prevents security issues (users linking others' media)
   * - Ensures media is not already linked to another post
   */
  async validateMediaOwnership(req: Request, res: Response): Promise<void> {
    try {
      const { mediaIds, userId } = req.body;

      if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
        return sendErrorResponse(res, {
          status: 400,
          message: "mediaIds array is required",
        });
      }

      if (!userId) {
        return sendErrorResponse(res, {
          status: 400,
          message: "userId is required",
        });
      }

      const result = await this.mediaService.validateMediaOwnership({
        mediaIds,
        userId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in validateMediaOwnership", {
        error: error.message,
        stack: error.stack,
      });
      sendErrorResponse(res, error);
    }
  }

  /**
   * Link media to post (called by Post Service)
   * 
   * Why this endpoint exists:
   * - Post Service creates post, then links media
   * - Media Service is source of truth for media records
   * - Ensures consistency across services
   */
  async linkMediaToPost(req: Request, res: Response): Promise<void> {
    try {
      const { mediaIds, postId, userId } = req.body;

      if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
        return sendErrorResponse(res, {
          status: 400,
          message: "mediaIds array is required",
        });
      }

      if (!postId) {
        return sendErrorResponse(res, {
          status: 400,
          message: "postId is required",
        });
      }

      if (!userId) {
        return sendErrorResponse(res, {
          status: 400,
          message: "userId is required",
        });
      }

      await this.mediaService.linkMediaToPost(mediaIds, postId, userId);

      res.status(200).json({
        success: true,
        message: "Media linked to post successfully",
      });
    } catch (error: any) {
      logger.error("Error in linkMediaToPost", {
        error: error.message,
        stack: error.stack,
      });
      sendErrorResponse(res, error);
    }
  }
}

