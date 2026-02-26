import { IProjectSendService } from "../interfaces/IProjectSendService";
import { IProjectRepository } from "../../repositories/interface/IProjectRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import * as grpc from "@grpc/grpc-js";
import logger from "../../utils/logger.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { OutboxAggregateType, OutboxEventType } from "@prisma/client";

/**
 * Project Send Service
 * Handles sending projects to connections (LinkedIn-style)
 * Creates notifications for each recipient
 */
export class ProjectSendService implements IProjectSendService {
  constructor(
    private _projectRepository: IProjectRepository,
    private _outboxService: IOutboxService
  ) {}

  async sendProject(
    projectId: string,
    senderId: string,
    recipientIds: string[],
    message?: string
  ): Promise<{
    success: boolean;
    sentTo: string[];
    message?: string;
  }> {
    try {
      // 1. Validate project exists
      const project = await this._projectRepository.findProject(projectId);
      if (!project) {
        throw new CustomError(grpc.status.NOT_FOUND, "Project not found");
      }

      // 2. Validate recipient IDs
      if (!recipientIds || recipientIds.length === 0) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "At least one recipient is required"
        );
      }

      // 3. Remove sender from recipients (can't send to yourself)
      const validRecipients = recipientIds.filter((id) => id !== senderId);
      if (validRecipients.length === 0) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Cannot send project to yourself"
        );
      }

      // 5. Get event version and timestamp for ordering
      const version = Date.now();
      const eventTimestamp = new Date().toISOString();

      // 6. Create outbox events for notifications
      // Each recipient gets a separate notification
      for (const recipientId of validRecipients) {
        try {
          await this._outboxService.createOutboxEvent({
            aggregateType: OutboxAggregateType.PROJECT,
            aggregateId: projectId,
            type: OutboxEventType.PROJECT_SENT,
            topic: KAFKA_TOPICS.PROJECT_SENT || "project.sent.v1", // Replace topic if defined
            key: recipientId, // Use recipientId as key for partitioning
            payload: {
              projectId,
              senderId,
              recipientId,
              message: message || undefined,
              projectAuthorId: project.userId,
              projectContent: project.description.substring(0, 200), // Preview
              eventTimestamp,
              version,
              action: "PROJECT_SENT",
            },
          });
        } catch (outboxError: any) {
          logger.error("Failed to create outbox event for recipient", {
            recipientId,
            projectId,
            error: outboxError.message,
            stack: outboxError.stack,
          });
        }
      }
      
      // 7. Notify the project author that their project was shared (sent to connections)
      if (senderId !== project.userId) {
        try {
          await this._outboxService.createOutboxEvent({
            aggregateType: OutboxAggregateType.PROJECT,
            aggregateId: projectId,
            type: OutboxEventType.PROJECT_SHARE_CREATED,
            topic: KAFKA_TOPICS.PROJECT_SENT || "project.sent.v1", // Use same topic
            key: project.userId,
            payload: {
              projectId,
              senderId,
              recipientId: project.userId,
              projectAuthorId: project.userId,
              action: "PROJECT_SHARED",
              eventTimestamp,
              version,
            },
          });
          logger.info(`Project share notification event created for author ${project.userId}`);
        } catch (error: any) {
          logger.error("Failed to create share notification for project author", {
            authorId: project.userId,
            projectId,
            error: error.message,
          });
        }
      }

      logger.info(`Project ${projectId} sent to ${validRecipients.length} recipients`, {
        projectId,
        senderId,
        recipientCount: validRecipients.length,
      });

      return {
        success: true,
        sentTo: validRecipients,
        message: message || undefined,
      };
    } catch (error: any) {
      logger.error("Error sending project", {
        error: error.message,
        projectId,
        senderId,
        recipientCount: recipientIds?.length || 0,
      });
      throw error instanceof CustomError
        ? error
        : new CustomError(grpc.status.INTERNAL, "Failed to send project");
    }
  }
}
