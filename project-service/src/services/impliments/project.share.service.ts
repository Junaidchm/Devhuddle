import * as grpc from "@grpc/grpc-js";
import {
  ShareProjectRequest,
  ShareProjectResponse,
} from "../../grpc/generated/project";
import { IProjectShareService } from "../interfaces/IProjectShareService";
import { IProjectShareRepository } from "../../repositories/interface/IProjectShareRepository";
import { IProjectRepository } from "../../repositories/interface/IProjectRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { OutboxAggregateType, OutboxEventType } from "@prisma/client";

export class ProjectShareService implements IProjectShareService {
  constructor(
    private shareRepository: IProjectShareRepository,
    private projectRepository: IProjectRepository,
    private outboxService?: IOutboxService
  ) {}

  async shareProject(req: ShareProjectRequest): Promise<ShareProjectResponse> {
    try {
      // Validate project exists
      const project = await this.projectRepository.findProject(req.projectId);
      if (!project) {
        throw new CustomError(grpc.status.NOT_FOUND, "Project not found");
      }

      // Validate share type
      if (req.shareType !== "SHARE" && req.shareType !== "QUOTE") {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid share type. Must be SHARE or QUOTE"
        );
      }

      // Validate caption length if provided
      if (req.caption && req.caption.length > 1000) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Caption too long (max 1000 characters)"
        );
      }

      // Create share
      const share = await this.shareRepository.createShare({
        projectId: req.projectId,
        userId: req.userId,
        shareType: req.shareType,
        caption: req.caption,
      });

      // Get updated count
      const sharesCount = await this.shareRepository.getShareCount(req.projectId);

      // Publish event
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT_SHARE,
          aggregateId: req.projectId,
          type: OutboxEventType.PROJECT_SHARE_CREATED,
          topic: KAFKA_TOPICS.PROJECT_SHARE_CREATED,
          key: share.id,
          payload: {
            shareId: share.id,
            projectId: req.projectId,
            userId: req.userId,
            shareType: req.shareType,
            sharesCount,
          },
        });
      }

      return {
        shareId: share.id,
        sharesCount,
      };
    } catch (err: unknown) {
      logger.error("ShareProject error", { error: (err as Error).message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, (err as Error).message);
    }
  }
}

