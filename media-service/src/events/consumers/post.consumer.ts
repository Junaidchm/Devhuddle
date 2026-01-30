import { IMediaService } from "../../services/interfaces/IMediaService";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import logger from "../../utils/logger.util";
import { kafkaConsumer } from "../../utils/kafka.consumer.util";

export class PostConsumer {
  constructor(private mediaService: IMediaService) {}

  public async init(): Promise<void> {
    // Register handlers
    kafkaConsumer.registerHandler(
      KAFKA_TOPICS.POST_DELETED,
      this.handlePostDeleted.bind(this)
    );

    // Subscribe to topics
    await kafkaConsumer.subscribe([KAFKA_TOPICS.POST_DELETED]);
    
    // Connect and run
    await kafkaConsumer.connect();
    await kafkaConsumer.run();
  }

  private async handlePostDeleted(payload: {
    postId: string;
    userId: string;
    mediaIds: string[];
    action: string;
  }): Promise<void> {
    const { postId, userId, mediaIds } = payload;
    
    logger.info("Received POST_DELETED event", { postId, mediaCount: mediaIds?.length });

    if (!mediaIds || mediaIds.length === 0) {
      return;
    }

    try {
      const deletePromises = mediaIds.map(async (mediaId) => {
        try {
          await this.mediaService.deleteMedia(mediaId, userId);
          logger.info(`Deleted media ${mediaId} for post ${postId}`);
        } catch (error) {
            // Log individual errors but continue with others
          logger.error(`Failed to delete media ${mediaId}`, {
            error: (error as Error).message,
            mediaId,
            postId,
          });
        }
      });

      await Promise.all(deletePromises);
      logger.info(`Completed media cleanup for post ${postId}`);
    } catch (error) {
      logger.error("Error in handlePostDeleted", {
        error: (error as Error).message,
        postId,
      });
      // In a real production system, we might want to retry or send to DLQ here
    }
  }
}
