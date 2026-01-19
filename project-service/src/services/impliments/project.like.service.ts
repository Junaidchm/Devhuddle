import * as grpc from "@grpc/grpc-js";
import {
  LikeProjectRequest,
  LikeProjectResponse,
  UnlikeProjectRequest,
  UnlikeProjectResponse,
} from "../../grpc/generated/project";
import { IProjectLikeService } from "../interfaces/IProjectLikeService";
import { IProjectLikeRepository } from "../../repositories/interface/IProjectLikeRepository";
import { IProjectRepository } from "../../repositories/interface/IProjectRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { OutboxAggregateType, OutboxEventType } from "@prisma/client";

export class ProjectLikeService implements IProjectLikeService {
  constructor(
    private _likeRepository: IProjectLikeRepository,
    private _projectRepository: IProjectRepository,
    private outboxService?: IOutboxService
  ) {}

  async likeProject(req: LikeProjectRequest): Promise<LikeProjectResponse> {
    try {
      // Validate project exists
      const project = await this._projectRepository.findProject(req.projectId);
      if (!project) {
        throw new CustomError(grpc.status.NOT_FOUND, "Project not found");
      }

      // Check if already liked
      const existingLike = await this._likeRepository.findLike(req.projectId, req.userId);
      if (existingLike) {
        // Already liked - return current count (idempotent)
        const likesCount = await this._likeRepository.getLikeCount(req.projectId);
        return {
          isLiked: true,
          likesCount,
        };
      }

      // Create like
      await this._likeRepository.createLike({
        projectId: req.projectId,
        userId: req.userId,
      });

      // Get updated count
      const likesCount = await this._likeRepository.getLikeCount(req.projectId);

      // Publish event
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT_LIKE,
          aggregateId: req.projectId,
          type: OutboxEventType.PROJECT_LIKE_CREATED,
          topic: KAFKA_TOPICS.PROJECT_LIKE_CREATED,
          key: `${req.projectId}:${req.userId}`,
          payload: {
            projectId: req.projectId,
            userId: req.userId,
            likesCount,
          },
        });
      }

      return {
        isLiked: true,
        likesCount,
      };
    } catch (err: unknown) {
      logger.error("LikeProject error", { error: (err as Error).message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, (err as Error).message);
    }
  }

  async unlikeProject(req: UnlikeProjectRequest): Promise<UnlikeProjectResponse> {
    try {
      // Validate project exists
      const project = await this._projectRepository.findProject(req.projectId);
      if (!project) {
        throw new CustomError(grpc.status.NOT_FOUND, "Project not found");
      }

      // Check if liked
      const existingLike = await this._likeRepository.findLike(req.projectId, req.userId);
      if (!existingLike) {
        // Not liked - return current count (idempotent)
        const likesCount = await this._likeRepository.getLikeCount(req.projectId);
        return {
          isLiked: false,
          likesCount,
        };
      }

      // Delete like
      await this._likeRepository.deleteLike(req.projectId, req.userId);

      // Get updated count
      const likesCount = await this._likeRepository.getLikeCount(req.projectId);

      // Publish event
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT_LIKE,
          aggregateId: req.projectId,
          type: OutboxEventType.PROJECT_LIKE_REMOVED,
          topic: KAFKA_TOPICS.PROJECT_LIKE_REMOVED,
          key: `${req.projectId}:${req.userId}`,
          payload: {
            projectId: req.projectId,
            userId: req.userId,
            likesCount,
          },
        });
      }

      return {
        isLiked: false,
        likesCount,
      };
    } catch (err: unknown) {
      logger.error("UnlikeProject error", { error: (err as Error).message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, (err as Error).message);
    }
  }
}

