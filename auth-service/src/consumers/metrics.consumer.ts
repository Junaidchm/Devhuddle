import { getConsumer } from '../utils/kafka.util';
import { KAFKA_TOPICS } from '../config/kafka.config';
import prisma from '../config/prisma.config';
import logger from '../utils/logger.util';

const GROUP_ID = "auth-metrics-group";

export async function startMetricsConsumer(): Promise<void> {
  const consumer = await getConsumer(GROUP_ID);
  
  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.POST_CREATED,
      KAFKA_TOPICS.POST_DELETED,
      KAFKA_TOPICS.POST_COMMENT_CREATED,
      KAFKA_TOPICS.POST_COMMENT_DELETED,
      KAFKA_TOPICS.POST_LIKE_CREATED,
      KAFKA_TOPICS.POST_LIKE_REMOVED,
      KAFKA_TOPICS.SHARE_CREATED
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      
      try {
        const event = JSON.parse(message.value.toString());
        logger.debug(`Metrics event received`, { topic, event });

        await updateMetrics(topic, event);

      } catch (error: unknown) {
        logger.error(`Error processing metrics event`, {
          topic,
          error: (error as Error).message,
        });
      }
    },
  });
  
  logger.info("Metrics consumer started and subscribed to content topics");
}

async function updateMetrics(topic: string, event: any): Promise<void> {
  const statsId = "global-stats";
  
  // Ensure the global stats row exists
  // We use upsert to either create it with defaults or just leave it to be updated
  const ensureStats = async () => {
    await prisma.systemStats.upsert({
      where: { id: statsId },
      update: {},
      create: { id: statsId }
    });
  };

  switch (topic) {
    case KAFKA_TOPICS.POST_CREATED:
      await ensureStats();
      await prisma.systemStats.update({
        where: { id: statsId },
        data: { totalPosts: { increment: 1 } }
      });
      break;
    
    case KAFKA_TOPICS.POST_DELETED:
      await ensureStats();
      await prisma.systemStats.update({
        where: { id: statsId },
        data: { totalPosts: { decrement: 1 } }
      });
      break;

    case KAFKA_TOPICS.POST_COMMENT_CREATED:
      await ensureStats();
      await prisma.systemStats.update({
        where: { id: statsId },
        data: { totalComments: { increment: 1 } }
      });
      break;

    case KAFKA_TOPICS.POST_COMMENT_DELETED:
      await ensureStats();
      await prisma.systemStats.update({
        where: { id: statsId },
        data: { totalComments: { decrement: 1 } }
      });
      break;

    case KAFKA_TOPICS.POST_LIKE_CREATED:
    case KAFKA_TOPICS.COMMENT_LIKE_CREATED:
      await ensureStats();
      await prisma.systemStats.update({
        where: { id: statsId },
        data: { totalLikes: { increment: 1 } }
      });
      break;

    case KAFKA_TOPICS.POST_LIKE_REMOVED:
    case KAFKA_TOPICS.COMMENT_LIKE_REMOVED:
      await ensureStats();
      await prisma.systemStats.update({
        where: { id: statsId },
        data: { totalLikes: { decrement: 1 } }
      });
      break;

    case KAFKA_TOPICS.SHARE_CREATED:
      await ensureStats();
      await prisma.systemStats.update({
        where: { id: statsId },
        data: { totalShares: { increment: 1 } }
      });
      break;

    default:
      logger.warn(`Unhandled topic in metrics consumer: ${topic}`);
  }
}
