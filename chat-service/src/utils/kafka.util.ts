import { Kafka, Producer } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "./logger.util";
import { v4 as uuidv4 } from "uuid";

let producer: Producer | null = null;

/**
 * Get or create Kafka producer instance (singleton pattern)
 */
export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = new Kafka(KAFKA_CONFIG);
    producer = kafka.producer({
      retry: {
        initialRetryTime: 100,
        retries: 5,
        maxRetryTime: 30000,
        restartOnFailure: async (err: Error) => {
          logger.error("Kafka producer restart on failure", {
            error: err.message,
          });
          return true; // Always attempt to restart on failure
        },
      },
      allowAutoTopicCreation: false,
      idempotent: true, // Prevent duplicate messages
    });
    
    await producer.connect();
    logger.info("Kafka producer connected");
  }
  return producer;
}

/**
 * Publish chat event to Kafka
 * @param event - Event data to publish
 * @param dedupeId - Optional deduplication ID
 */
export async function publishChatEvent(
  event: any,
  dedupeId?: string
): Promise<void> {
  try {
    const producer = await getProducer();
    
    const eventWithMetadata = {
      ...event,
      dedupeId: dedupeId || uuidv4(),
      timestamp: new Date().toISOString(),
      source: "chat-service",
      version: event.version ?? 1,
    };

    await producer.send({
      topic: KAFKA_TOPICS.CHAT_EVENTS,
      messages: [
        {
          key: event.senderId || event.conversationId,
          value: JSON.stringify(eventWithMetadata),
          headers: {
            "event-type": event.eventType || "MessageSent",
            "dedupe-id": eventWithMetadata.dedupeId,
            source: "chat-service",
          },
        },
      ],
    });

    logger.info("Chat event published successfully", {
      topic: KAFKA_TOPICS.CHAT_EVENTS,
      eventType: event.eventType,
      dedupeId: eventWithMetadata.dedupeId,
    });
  } catch (error: unknown) {
    logger.error("Failed to publish chat event", {
      topic: KAFKA_TOPICS.CHAT_EVENTS,
      error: (error as Error).message,
    });
    // Don't throw - Kafka failure shouldn't break message sending
    // Message is already saved to database, event publishing is async/optional
  }
}

/**
 * Disconnect Kafka producer gracefully
 */
export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    logger.info("Kafka producer disconnected");
  }
}
