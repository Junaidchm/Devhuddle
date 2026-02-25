import { getConsumer } from "../utils/kafka.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import { NotificationsRepository } from "../repository/impliments/notifications.repository";
import { WebSocketService } from "../utils/websocket.util";
import logger from "../utils/logger.util";

const GROUP_ID = "notification-admin-group";

interface AdminActionEvent {
  targetId: string;
  targetType: "PROJECT" | "POST" | "COMMENT" | "HUB" | "MESSAGE" | "CONVERSATION" | "USER";
  ownerId: string;
  action: "HIDE" | "UNHIDE" | "DELETE" | "BAN" | "SUSPEND" | "WARN";
  reason: string;
  adminId: string;
  timestamp: string;
  version: number;
}

export class AdminConsumer {
  private repository: NotificationsRepository;

  constructor(repository: NotificationsRepository) {
    this.repository = repository;
  }

  async run() {
    try {
      const consumer = await getConsumer(GROUP_ID);
      await consumer.subscribe({
        topic: KAFKA_TOPICS.ADMIN_ACTION_ENFORCED,
        fromBeginning: false,
      });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            if (!message.value) return;

            const event: AdminActionEvent = JSON.parse(message.value.toString());
            logger.info("Admin action event received", {
              targetId: event.targetId,
              action: event.action,
            });

            // Notify content owner
            await this.repository.createEnforcedNotification(
              event.adminId,
              event.ownerId,
              event.targetId,
              event.targetType,
              event.action,
              event.reason,
              event.version || Date.now()
            );

          } catch (error: any) {
            logger.error("Error processing admin action message", {
              error: error.message,
              topic,
              partition,
            });
          }
        },
      });

      logger.info("Admin consumer is running...");
    } catch (error: any) {
      logger.error("Failed to start admin consumer", { error: error.message });
    }
  }
}

export const startAdminConsumer = async (wsService: WebSocketService) => {
  const repository = new NotificationsRepository(wsService);
  const consumer = new AdminConsumer(repository);
  await consumer.run();
};
