import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Prisma, ProjectMedia } from "@prisma/client";
import { IProjectMediaRepository, UploadProjectMediaRequest } from "../interface/IProjectMediaRepository";
import logger from "../../utils/logger.util";
import { v4 as uuidv4 } from "uuid";

export class ProjectMediaRepository
  extends BaseRepository<
    typeof prisma.projectMedia,
    ProjectMedia,
    Prisma.ProjectMediaCreateInput,
    Prisma.ProjectMediaUpdateInput,
    Prisma.ProjectMediaWhereUniqueInput
  >
  implements IProjectMediaRepository
{
  constructor() {
    super(prisma.projectMedia);
  }

  async createProjectMedia(data: UploadProjectMediaRequest): Promise<string> {
    try {
      // Create media without projectId (will be attached when project is created)
      const { id: mediaId } = await super.create({
        id: uuidv4(),
        projectId: null, // Nullable - will be attached when project is created
        type: data.type,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl,
        width: data.width,
        height: data.height,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        duration: data.duration,
        order: 0,
        isPreview: false,
        processingStatus: "COMPLETED",
      } as any);
      return mediaId;
    } catch (error: any) {
      logger.error("Error creating project media", {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw new Error("Database error");
    }
  }
}

