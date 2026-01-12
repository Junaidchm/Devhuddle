import { Kafka, Producer, ProducerRecord } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "./logger.util";

let producer: Producer | null = null;

/**
 * Get or create Kafka producer instance (Singleton pattern)
 */
export async function getProducer(): Promise<Producer> {
    if (producer) {
        return producer;
    }

    try {
        const kafka = new Kafka(KAFKA_CONFIG);
        producer = kafka.producer();

        // Set up error handlers
        producer.on("producer.connect", () => {
            logger.info("Kafka producer connected");
        });

        producer.on("producer.disconnect", () => {
            logger.warn("Kafka producer disconnected");
        });

        // Connect the producer
        await producer.connect();
        logger.info("Kafka producer initialized successfully");

        return producer;
    } catch (error) {
        logger.error("Failed to initialize Kafka producer", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        throw error;
    }
}

/**
 * Generate deduplication ID using crypto (built-in Node.js module)
 */
function generateDedupeId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
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
      dedupeId: dedupeId || generateDedupeId(),
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
