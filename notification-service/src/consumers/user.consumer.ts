import { getConsumer } from "../utils/kafka.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import { NotificationsRepository } from "../repository/impliments/notifications.repository";
import logger from "../utils/logger.util";
import { WebSocketService } from "../utils/websocket.util";

const GROUP_ID = "notification-user-cleanup-group";

/**
 * Handles account deletion events for the notification-service.
 * Listens for USER_DELETED events and purges all notification data for the user.
 */
export async function startUserConsumer(wsService: WebSocketService): Promise<void> {
  const repo = new NotificationsRepository(wsService);
  const consumer = await getConsumer(GROUP_ID);

  await consumer.subscribe({
    topics: [KAFKA_TOPICS.USER_DELETED],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      let event: any;
      try {
        event = JSON.parse(message.value.toString());
      } catch (err) {
        logger.error("UserConsumer: Failed to parse message", { topic });
        return;
      }

      logger.info(`UserConsumer received event on topic: ${topic}`, {
        userId: event.userId,
      });

      try {
        if (topic === KAFKA_TOPICS.USER_DELETED) {
          await repo.deleteUserNotifications(event.userId);
        }
      } catch (err: any) {
        logger.error("UserConsumer: Failed to handle event", {
          topic,
          error: err.message,
          event,
        });
      }
    },
  });

  logger.info("UserConsumer started and subscribed to user-events topic");
}
