import { IMediaService } from "../../services/interfaces/IMediaService";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import logger from "../../utils/logger.util";
import { kafkaConsumer } from "../../utils/kafka.consumer.util";

/**
 * Handles account-level events for the media-service.
 * Primarily listens for USER_DELETED events to purge user-owned media.
 */
export class UserConsumer {
  constructor(private mediaService: IMediaService) {}

  public async init(): Promise<void> {
    // Register handlers
    kafkaConsumer.registerHandler(
      KAFKA_TOPICS.USER_DELETED,
      this.handleUserDeleted.bind(this)
    );

    // Subscribe to topics
    await kafkaConsumer.subscribe([KAFKA_TOPICS.USER_DELETED]);
    
    // Connect and run
    await kafkaConsumer.connect();
    await kafkaConsumer.run();
  }

  /**
   * Processes a USER_DELETED event.
   * Triggers a comprehensive purge of all media files and records for the user.
   */
  private async handleUserDeleted(payload: { userId: string }): Promise<void> {
    const { userId } = payload;
    
    logger.info("🗑️ Account deletion Saga (Media): Purging user media", { userId });

    if (!userId) {
      logger.warn("Received USER_DELETED event with missing userId");
      return;
    }

    try {
      await this.mediaService.deleteAllUserMedia(userId);
      logger.info(`✅ Successfully purged all media for user ${userId}`);
    } catch (error) {
      logger.error("❌ Error in handleUserDeleted (Media)", {
        error: (error as Error).message,
        userId,
      });
      // In a production environment, you might re-queue this or send to a DLQ
    }
  }
}
