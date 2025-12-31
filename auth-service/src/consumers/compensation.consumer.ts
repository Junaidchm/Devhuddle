import { getConsumer } from '../utils/kafka.util';
import { KAFKA_TOPICS } from '../config/kafka.config';
import { FollowsRepository } from '../repositories/impliments/follows.repository';
import { RedisCacheService } from '../utils/redis.util';
import logger from '../utils/logger.util';

const GROUP_ID = "auth-compensation-group";
const repo = new FollowsRepository();

import { CompensationEvent } from '../types/common.types';

// ...

export async function startCompensationConsumer(): Promise<void> {
  const consumer = await getConsumer(GROUP_ID);
  
  await consumer.subscribe({
    topics: [KAFKA_TOPICS.NOTIFICATION_FAILED],
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      
      const event: CompensationEvent = JSON.parse(message.value.toString());
      const { 
        followerId, 
        followingId, 
        compensationReason,
        originalDedupeId 
      } = event;

      logger.info(`Compensation event received`, {
        topic,
        followerId,
        followingId,
        compensationReason,
        originalDedupeId,
      });

      try {
        // Handle different types of compensation
        if (compensationReason === 'notification_processing_failed') {
          await handleFollowCompensation(followerId, followingId, event);
        } else if (compensationReason === 'notification_creation_failed') {
          await handleNotificationCreationCompensation(followerId, followingId, event);
        }

        logger.info(`Compensation completed successfully`, {
          followerId,
          followingId,
          compensationReason,
        });

      } catch (error: unknown) {
        logger.error(`Error processing compensation event`, {
          error: (error as Error).message,
          followerId,
          followingId,
          compensationReason,
        });

        // If compensation fails, we might need to alert administrators
        // or implement additional recovery mechanisms
        await handleCompensationFailure(event, error);
      }
    },
  });
}

/**
 * Handle follow compensation - revert the follow operation
 */
async function handleFollowCompensation(
  followerId: string, 
  followingId: string, 
  event: CompensationEvent
): Promise<void> {
  try {
    // Check if the follow relationship still exists
    const followExists = await repo.checkFollowExists(followerId, followingId);
    
    if (followExists) {
      // Revert the follow operation
      await repo.unfollow(followerId, followingId);
      
      // Update cache
      await RedisCacheService.decrementFollowerCount(followingId);
      await RedisCacheService.invalidateUserCaches(followerId);
      
      logger.info(`Follow relationship reverted`, {
        followerId,
        followingId,
        reason: 'notification_processing_failed',
      });
    } else {
      logger.info(`Follow relationship already reverted or never existed`, {
        followerId,
        followingId,
      });
    }
  } catch (error: unknown) {
    logger.error(`Error reverting follow relationship`, {
      error: (error as Error).message,
      followerId,
      followingId,
    });
    throw error;
  }
}

/**
 * Handle notification creation compensation
 */
async function handleNotificationCreationCompensation(
  followerId: string,
  followingId: string,
  event: CompensationEvent
): Promise<void> {
  try {
    // This might involve:
    // 1. Logging the failure for manual review
    // 2. Attempting to create the notification again
    // 3. Notifying administrators
    
    logger.warn(`Notification creation failed - manual intervention may be required`, {
      followerId,
      followingId,
      originalEvent: event,
    });

    // For now, we'll just log it. In production, you might:
    // 1. Send to a manual review queue
    // 2. Attempt retry with different parameters
    // 3. Notify administrators via Slack/email
    
  } catch (error: unknown) {
    logger.error(`Error handling notification creation compensation`, {
      error: (error as Error).message,
      followerId,
      followingId,
    });
    throw error;
  }
}

/**
 * Handle compensation failure
 */
async function handleCompensationFailure(event: CompensationEvent, error: unknown): Promise<void> {
  try {
    // Log the compensation failure for manual review
    logger.error(`COMPENSATION FAILURE - Manual intervention required`, {
      event,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    });

    // In production, you would:
    // 1. Send alert to administrators
    // 2. Store in a separate failure queue
    // 3. Update monitoring dashboards
    // 4. Possibly trigger additional recovery mechanisms
    
  } catch (compensationError: unknown) {
    logger.error(`Error handling compensation failure`, {
      error: (compensationError as Error).message,
      originalError: (error as Error).message,
    });
  }
}