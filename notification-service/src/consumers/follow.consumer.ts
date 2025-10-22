import { getConsumer, publishEvent } from "../utils/kafka.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import { NotificationsRepository } from "../repository/impliments/notifications.repository";
import redisClient from "../config/redis.config";
import logger from "../utils/logger.util";

const GROUP_ID = "notification-follow-group";
const repo = new NotificationsRepository();

export async function startFollowConsumer(): Promise<void> {
  const consumer = await getConsumer(GROUP_ID);
  console.log('the consumer is owrking without any problem -------------->')
  await consumer.subscribe({
    topics: [KAFKA_TOPICS.USER_FOLLOWED, KAFKA_TOPICS.USER_UNFOLLOWED],
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString());
      const {
        followerId: issuerId,
        followingId: recipientId,
        dedupeId,
        version,
      } = event;

    
      // Idempotency: Redis duplicate id finding deuupeId
      if (await redisClient.sIsMember("processed-notifications", dedupeId)) {
        logger.info(`Duplicate event skipped: ${dedupeId}`);
        return;
      }
      await redisClient.sAdd("processed-notifications", dedupeId);
      await redisClient.expire("processed-notifications", 3600);

      try {
        if (topic === KAFKA_TOPICS.USER_FOLLOWED) {
          await repo.createFollowNotification(issuerId, recipientId, version);
        }
        if (topic === KAFKA_TOPICS.USER_UNFOLLOWED) {
          await repo.deleteFollowNotification(issuerId, recipientId);
        }
        logger.info(`Processed event ${topic} for ${recipientId}`);
      } catch (error: any) {
        logger.error(`Error processing ${topic}:`, error);
        await publishEvent(`${topic}-dlq`, {
          ...event,
          error: (error as Error).message,
        });
      }
    },
  });

}
