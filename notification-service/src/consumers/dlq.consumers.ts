import { getConsumer } from "../utils/kafka.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import logger from "../utils/logger.util";
import prisma from "../config/prisma.config";

const GROUP_ID = "notification-dlq-group";

export async function startDLQConsumer(): Promise<void> {
  const consumer = await getConsumer(GROUP_ID);
  
  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.USER_FOLLOWED_DLQ,
      KAFKA_TOPICS.USER_UNFOLLOWED_DLQ,
      // KAFKA_TOPICS.LIKE_ADDED_DLQ,
      // KAFKA_TOPICS.LIKE_REMOVED_DLQ,
      // KAFKA_TOPICS.COMMENT_ADDED_DLQ,
      KAFKA_TOPICS.NOTIFICATION_FAILED_DLQ,
    ],
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      
      const event = JSON.parse(message.value.toString());
      
      logger.error(`DLQ Event received`, {
        topic,
        originalTopic: event.originalTopic,
        errorMessage: event.errorMessage,
        dlqReason: event.dlqReason,
        event,
      });

      try {
        // Store DLQ event in database for manual review
        await prisma.dlqEvent.create({
          data: {
            originalTopic: event.originalTopic,
            dlqTopic: topic,
            eventData: event,
            errorMessage: event.errorMessage,
            dlqReason: event.dlqReason,
            retryCount: event.retryCount || 0,
            status: 'PENDING',
            createdAt: new Date(event.dlqTimestamp || new Date()),
          },
        });

        logger.info(`DLQ event stored in database`, {
          originalTopic: event.originalTopic,
          dlqTopic: topic,
        });

        // Send alert to monitoring system (if configured)
        await sendDLQAlert(event, topic);

      } catch (error: any) {
        logger.error(`Error processing DLQ event`, {
          error: error.message,
          topic,
          event,
        });
      }
    },
  });
}

/**
 * Send alert for DLQ events
 */
async function sendDLQAlert(event: any, dlqTopic: string): Promise<void> {
  try {
    
    logger.error(`DLQ ALERT: Event failed permanently`, {
      originalTopic: event.originalTopic,
      dlqTopic,
      errorMessage: event.errorMessage,
      retryCount: event.retryCount || 0,
      timestamp: new Date().toISOString(),
    });

   
  } catch (error:any) {
    logger.error('Failed to send DLQ alert', { error: error.message });
  }
}