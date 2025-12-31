import { getConsumer, publishEvent } from "../utils/kafka.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import { NotificationsRepository } from "../repository/impliments/notifications.repository";
import redisClient from "../config/redis.config";
import logger from "../utils/logger.util";
import { WebSocketService } from "../utils/websocket.util";

const GROUP_ID = "notification-follow-group";

interface FollowEvent {
  followerId: string;
  followingId: string;
  dedupeId: string;
  version: number;
}

interface CompensationEvent {
  originalDedupeId: string;
  compensationReason: string;
}

export async function startFollowConsumer(wsService: WebSocketService): Promise<void> {
  const repo = new NotificationsRepository(wsService);
  const consumer = await getConsumer(GROUP_ID);

  consumer.subscribe({
    topics: [
      KAFKA_TOPICS.USER_FOLLOWED,
      KAFKA_TOPICS.USER_UNFOLLOWED,
      KAFKA_TOPICS.NOTIFICATION_FAILED,
    ],
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      // Handle raw parsing safely
      const rawEvent = JSON.parse(message.value.toString());
      
      // Basic validation/typing could go here, for now cast
      const event = rawEvent as FollowEvent; 
      const {
        followerId: issuerId,
        followingId: recipientId,
        dedupeId,
        version,
      } = event;

      if (await redisClient.sIsMember("processed-notifications", dedupeId)) {
        logger.info(`Duplicate event skipped: ${dedupeId}`);
        return;
      }

      try {
        // Mark as processing
        await redisClient.sAdd("processed-notifications", dedupeId);
        await redisClient.expire("processed-notifications", 3600);

        if (topic === KAFKA_TOPICS.USER_FOLLOWED) {
          await repo.createFollowNotification(issuerId, recipientId, version);
          logger.info(`Follow notification created for ${recipientId}`);
        } else if (topic === KAFKA_TOPICS.USER_UNFOLLOWED) {
          await repo.deleteFollowNotification(issuerId, recipientId);
          logger.info(`Follow notification deleted for ${recipientId}`);
        } else if (topic === KAFKA_TOPICS.NOTIFICATION_FAILED) {
          // Handle compensation events
          await handleCompensationEvent(rawEvent as CompensationEvent);
        }
      } catch (error: unknown) {
        logger.error("Error processing follow event", {
          error: (error as Error).message,
          topic,
          dedupeId,
        });
      }
    },
  });
}

/**
 * Handle compensation events for Saga pattern
 */
async function handleCompensationEvent(event: CompensationEvent): Promise<void> {
  try {
    logger.info(`Processing compensation event`, {
      originalDedupeId: event.originalDedupeId,
      compensationReason: event.compensationReason,
    });

    // Here you would implement the compensation logic
    // For example, revert the follow operation in the auth service
    // This would typically involve calling the auth service API or publishing a revert event

    logger.info(`Compensation event processed successfully`);
  } catch (error: unknown) {
    logger.error(`Error processing compensation event`, {
      error: (error as Error).message,
      event,
    });
  }
}
