import { IProjectMediaService, UploadProjectMediaRequest, UploadProjectMediaResponse } from "../interfaces/IProjectMediaService";
import { IProjectMediaRepository } from "../../repositories/interface/IProjectMediaRepository";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";

export class ProjectMediaService implements IProjectMediaService {
  constructor(private _mediaRepository: IProjectMediaRepository) {}

  async uploadProjectMedia(req: UploadProjectMediaRequest): Promise<UploadProjectMediaResponse> {
    try {
      // Validation
      if (!req.url || !req.type) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "URL and type are required");
      }

      if (req.type !== "IMAGE" && req.type !== "VIDEO") {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Type must be IMAGE or VIDEO");
      }

      const mediaId = await this._mediaRepository.createProjectMedia(req);

      return { mediaId };
    } catch (err: unknown) {
      logger.error("Error uploading project media", { error: (err as Error).message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, (err as Error).message);
    }
  }
}


