import { Request, Response } from "express";
import { IProjectMediaService } from "../../services/interfaces/IProjectMediaService";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import logger from "../../utils/logger.util";
import { sendErrorResponse } from "../../utils/error.util";

export class ProjectMediaController {
  constructor(private mediaService: IProjectMediaService) {}

  async uploadProjectMediaHttp(req: Request, res: Response): Promise<void> {
    try {
      const { url, type, thumbnailUrl, width, height, fileSize, mimeType, duration } = req.body;

      if (!url || !type) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "URL and type are required");
      }

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

      res.status(HttpStatus.OK).json(response);
    } catch (err: any) {
      logger.error("Error in POST /api/v1/projects/media", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
        success: false,
      });
    }
  }
}


