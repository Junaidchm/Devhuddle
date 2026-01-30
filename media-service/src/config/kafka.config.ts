import { KafkaConfig } from "kafkajs";

export const KAFKA_CONFIG: KafkaConfig = {
  brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
  clientId: process.env.KAFKA_CLIENT_ID || "media-service",
  retry: {
    initialRetryTime: 100,
    retries: 5,
    maxRetryTime: 30000,
  },
};

export const KAFKA_TOPICS = {
  // Post Deletion events
  POST_DELETED: "post.deleted.v1",
  POST_DELETED_DLQ: "post.deleted.v1-dlq",
} as const;
