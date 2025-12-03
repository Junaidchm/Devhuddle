import { Kafka, Producer, Admin } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "./logger.util";

let producer: Producer | null = null;
let admin: Admin | null = null;

/**
 * Initialize Kafka topics (create if they don't exist)
 * This should be called once when the service starts
 */
export async function initializeKafkaTopics(): Promise<void> {
  try {
    if (!admin) {
      const kafka = new Kafka(KAFKA_CONFIG);
      admin = kafka.admin();
      await admin.connect();
      logger.info("Kafka admin connected");
    }

    // Get all topic names from KAFKA_TOPICS
    const topics = Object.values(KAFKA_TOPICS).map((topicName) => ({
      topic: topicName,
      numPartitions: 3,
      replicationFactor: 1,
      configEntries: [
        {
          name: "retention.ms",
          value: "604800000", // 7 days
        },
      ],
    }));

    // Check which topics already exist
    const existingTopics = await admin.listTopics();
    const topicsToCreate = topics.filter(
      (topic) => !existingTopics.includes(topic.topic)
    );

    if (topicsToCreate.length > 0) {
      logger.info(`Creating ${topicsToCreate.length} Kafka topics...`, {
        topics: topicsToCreate.map((t) => t.topic),
      });

      await admin.createTopics({
        topics: topicsToCreate,
        waitForLeaders: true,
        timeout: 30000,
      });

      logger.info("Kafka topics created successfully", {
        topics: topicsToCreate.map((t) => t.topic),
      });
    } else {
      logger.info("All Kafka topics already exist");
    }
  } catch (error: any) {
    if (error.message?.includes("already exists") || error.code === 36) {
      logger.info("Kafka topics already exist, continuing...");
    } else {
      logger.error("Failed to initialize Kafka topics", {
        error: error.message,
      });
      throw error;
    }
  }
}

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
          return true;
        },
      },
      allowAutoTopicCreation: false,
      idempotent: true,
    });
    await producer.connect();
    logger.info("Kafka producer connected");
  }
  return producer;
}

export async function publishEvent(
  topic: string,
  event: any,
  key?: string,
  retryCount: number = 0
): Promise<void> {
  try {
    const producer = await getProducer();
    await producer.send({
      topic,
      messages: [
        {
          key: key || undefined,
          value: JSON.stringify(event),
          headers: {
            "content-type": "application/json",
            timestamp: Date.now().toString(),
          },
        },
      ],
    });
    logger.info("Event published to Kafka", { topic, key });
  } catch (error: any) {
    logger.error("Failed to publish event to Kafka", {
      error: error.message,
      topic,
      retryCount,
    });
    if (retryCount < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return publishEvent(topic, event, key, retryCount + 1);
    }
    throw error;
  }
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    logger.info("Kafka producer disconnected");
  }
}

export async function disconnectAdmin(): Promise<void> {
  if (admin) {
    await admin.disconnect();
    admin = null;
    logger.info("Kafka admin disconnected");
  }
}

