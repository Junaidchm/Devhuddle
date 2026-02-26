import { IMentionService } from "../interfaces/IMentionService";
import { IMentionRepository } from "../../repositories/interface/IMentionRepository";
import logger from "../../utils/logger.util";
import { IOutboxService } from "../interfaces/IOutboxService";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import {
  OutboxAggregateType,
  OutboxEventType,
} from "@prisma/client";
import { userClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.util";
import { ResolveUsernamesRequest } from "../../grpc/generated/user";

export class MentionService implements IMentionService {
  constructor(
    private _mentionRepository: IMentionRepository,
    private _outboxService: IOutboxService
  ) {}

  async processMentions(
    content: string,
    projectId?: string,
    commentId?: string,
    actorId?: string
  ): Promise<string[]> {
    try {
      if (!content || typeof content !== "string") {
        return [];
      }

      // Extract mentions using regex (@username pattern)
      const mentionRegex = /@(\w+)/g;
      const matches = Array.from(content.matchAll(mentionRegex));
      const usernames = matches.map((match) => match[1]);

      if (usernames.length === 0) {
        return [];
      }

      // Remove duplicates
      const uniqueUsernames = [...new Set(usernames)];

      // Resolve usernames to user IDs via gRPC call to auth-service
      let mentionedUserIds: string[] = [];

      try {
        const resolveRequest: ResolveUsernamesRequest = {
          usernames: uniqueUsernames,
        };

        const resolveResponse = await grpcs<typeof userClient, ResolveUsernamesRequest, any>(
          userClient,
          "resolveUsernames",
          resolveRequest
        );

        if (
          typeof resolveResponse === "object" &&
          resolveResponse !== null &&
          Array.isArray(resolveResponse.users)
        ) {
          mentionedUserIds = resolveResponse.users.map(
            (user: { id: string }) => user.id
          );
        } else {
          mentionedUserIds = [];
        }

        if (mentionedUserIds.length === 0) {
          logger.info("No valid users found for mentions", {
            usernames: uniqueUsernames,
          });
          return [];
        }
      } catch (error: any) {
        logger.error("Error resolving usernames via gRPC", {
          error: error.message,
          usernames: uniqueUsernames,
        });
        return [];
      }

      // Create mentions in database
      const createdMentions: string[] = [];

      if (commentId && actorId) {
        for (const mentionedUserId of mentionedUserIds) {
          try {
            // Check if mention already exists
            const existingMentions = await this._mentionRepository.getCommentMentions(commentId);
            const alreadyMentioned = existingMentions.some(
              (m) => m.mentionedUserId === mentionedUserId
            );

            if (!alreadyMentioned) {
              await this._mentionRepository.createCommentMention({
                commentId,
                mentionedUserId,
                actorId,
              });

              createdMentions.push(mentionedUserId);

              // Create outbox event for mention
              // Use USER_MENTIONED topic as in post-service
              // We'll need to make sure this topic exists in project-service kafka config
              await this._outboxService.createOutboxEvent({
                aggregateType: OutboxAggregateType.PROJECT_COMMENT,
                aggregateId: commentId,
                type: OutboxEventType.PROJECT_COMMENT_CREATED, // We can use a specific type if needed, but for now we'll match engagement.consumer logic
                topic: "user-mentioned", // KAFKA_TOPICS.USER_MENTIONED in post-service is "user-mentioned"
                key: mentionedUserId,
                payload: {
                  dedupeId: `mention-${commentId}-${mentionedUserId}-${Date.now()}`,
                  commentId,
                  projectId,
                  userId: actorId,
                  mentionedUserId,
                  action: "USER_MENTIONED",
                  version: Date.now(),
                  eventTimestamp: new Date().toISOString(),
                },
              });

              logger.info("Project comment mention created", {
                commentId,
                mentionedUserId,
                actorId,
              });
            }
          } catch (error: any) {
            logger.error("Error creating project comment mention", {
              error: error.message,
              commentId,
              mentionedUserId,
              actorId,
            });
          }
        }
      }

      return createdMentions;
    } catch (err: any) {
      logger.error("Error processing mentions", {
        error: err.message,
        projectId,
        commentId,
        actorId,
      });
      return [];
    }
  }
}
