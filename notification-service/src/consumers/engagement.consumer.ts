import { getConsumer } from "../utils/kafka.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import { NotificationsRepository } from "../repository/impliments/notifications.repository";
import redisClient from "../config/redis.config";
import logger from "../utils/logger.util";
import { WebSocketService } from "../utils/websocket.util";

const GROUP_ID = "notification-engagement-group";

export async function startEngagementConsumer(wsService: WebSocketService): Promise<void> {
  // Pass wsService to repository (same pattern as follow.consumer.ts)
  const repo = new NotificationsRepository(wsService);
  const consumer = await getConsumer(GROUP_ID);

  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.POST_LIKE_CREATED,
      KAFKA_TOPICS.POST_LIKE_REMOVED,
      KAFKA_TOPICS.COMMENT_LIKE_CREATED,
      KAFKA_TOPICS.COMMENT_LIKE_REMOVED,
      KAFKA_TOPICS.POST_COMMENT_CREATED,
      KAFKA_TOPICS.POST_COMMENT_EDITED,
      KAFKA_TOPICS.POST_COMMENT_DELETED,
      KAFKA_TOPICS.POST_SHARED,
      KAFKA_TOPICS.POST_REPORTED,
      KAFKA_TOPICS.USER_MENTIONED,
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const { dedupeId } = event;

      // Idempotency check
      if (await redisClient.sIsMember("processed-notifications", dedupeId)) {
        logger.info(`Duplicate event skipped: ${dedupeId}`);
        return;
      }

      try {
        // Mark as processing
        await redisClient.sAdd("processed-notifications", dedupeId);
        await redisClient.expire("processed-notifications", 3600);

        // Process based on topic
        switch (topic) {
          case KAFKA_TOPICS.POST_LIKE_CREATED:
            await handlePostLikeCreated(event, repo);
            break;
          case KAFKA_TOPICS.POST_LIKE_REMOVED:
            await handlePostLikeRemoved(event, repo);
            break;
          case KAFKA_TOPICS.COMMENT_LIKE_CREATED:
            await handleCommentLikeCreated(event, repo);
            break;
          case KAFKA_TOPICS.COMMENT_LIKE_REMOVED:
            await handleCommentLikeRemoved(event, repo);
            break;
          // ... other cases ...
          default:
            logger.warn(`Unhandled topic: ${topic}`);
        }
      } catch (error: any) {
        logger.error(`Error processing engagement event`, {
          topic,
          error: error.message,
          event,
        });
      }
    },
  });
}

async function handlePostLikeCreated(event: any, repo: NotificationsRepository): Promise<void> {
  const { postId, userId, postAuthorId, version } = event;
  
  // Don't notify if user liked their own post
  if (userId === postAuthorId) return;

  // Repository handles broadcasting internally (no duplicate broadcast needed)
  await repo.createLikeNotification(userId, postAuthorId, postId, "POST", version as number);

  logger.info(`Post like notification created for ${postAuthorId}`);
}

async function handlePostLikeRemoved(event: any, repo: NotificationsRepository): Promise<void> {
  const { postId, userId, postAuthorId, version } = event;
  
  if (userId === postAuthorId) return;

  await repo.deleteLikeNotification(userId, postAuthorId, postId, "POST", version as number);

  logger.info(`Post like notification removed for ${postAuthorId}`);
}

async function handleCommentLikeCreated(event: any, repo: NotificationsRepository): Promise<void> {
  const { commentId, userId, commentAuthorId, version } = event;
  
  if (userId === commentAuthorId) return;

  await repo.createLikeNotification(userId, commentAuthorId, commentId, "COMMENT", version as number);

  logger.info(`Comment like notification created for ${commentAuthorId}`);
}

async function handleCommentLikeRemoved(event: any, repo: NotificationsRepository): Promise<void> {
  const { commentId, userId, commentAuthorId, version } = event;
  
  if (userId === commentAuthorId) return;
  
  await repo.deleteLikeNotification(userId, commentAuthorId, commentId, "COMMENT", version as number);
  
  logger.info(`Comment like notification removed for ${commentAuthorId}`);
}