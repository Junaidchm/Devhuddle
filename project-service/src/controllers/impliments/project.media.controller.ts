import { Request, Response } from "express";
import { IProjectMediaService } from "../../services/interfaces/IProjectMediaService";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import logger from "../../utils/logger.util";
import { sendErrorResponse } from "../../utils/error.util";

export class ProjectMediaController {
  constructor(private mediaService: IProjectMediaService) {}

  async uploadProjectMediaHttp(req: Request, res: Response): Promise<void> {
    // Check if request was aborted
    if (req.aborted || !req.readable) {
      logger.warn("Request aborted before processing", {
        url: req.url,
        method: req.method,
      });
      if (!res.headersSent && !res.writableEnded) {
        res.status(400).json({
          status: 400,
          message: "Request was cancelled",
          success: false,
        });
        return;
      }
      return;
    }

    try {
      // Validate request body exists
      // Validation handled by DTO

      const { url, type, thumbnailUrl, width, height, fileSize, mimeType, duration } = req.body;

      // Validation handled by DTO

      // Validate type
      // Validation handled by DTO

      // Validation handled by DTO

      logger.info("Processing project media upload", {
        type,
        url: url.substring(0, 100), // Log first 100 chars of URL
        hasThumbnail: !!thumbnailUrl,
      });

      const response = await this.mediaService.uploadProjectMedia({
        url,
        type,
        thumbnailUrl,
        width,
        height,
        fileSize,
        mimeType,
        duration,
      });

      // Check if response was already sent or connection closed
      if (res.headersSent || res.writableEnded) {
        logger.warn("Response already sent or connection closed", {
          mediaId: response.mediaId,
        });
        return;
      }

      res.status(HttpStatus.OK).json(response);
    } catch (err: any) {
      // Check if request was aborted during processing
      if (req.aborted || err.message === 'request aborted' || err.message?.includes('aborted')) {
        logger.warn("Request aborted during media upload processing", {
          error: err.message,
        });
        if (!res.headersSent && !res.writableEnded) {
          res.status(400).json({
            status: 400,
            message: "Request was cancelled",
            success: false,
          });
          return;
        }
        return;
      }

      logger.error("Error in POST /api/v1/projects/media", {
        error: err.message,
        stack: err.stack,
        url: req.url,
        body: req.body ? Object.keys(req.body) : null,
      });

      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      
      // Only send error response if headers not sent and connection not closed
      if (!res.headersSent && !res.writableEnded) {
        sendErrorResponse(res, {
          status: statusCode,
          message: err.message || "Server error",
          success: false,
        });
      }
    }
  }
}


