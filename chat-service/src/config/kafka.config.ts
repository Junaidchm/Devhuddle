

// Kafka Configuration
export const KAFKA_CONFIG = {
  clientId: "chat-service",
  brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
  logLevel: 2, // ERROR level (0=NOTHING, 1=ERROR, 2=WARN, 4=INFO, 5=DEBUG)
};

// Kafka Topics for Chat Service
export const KAFKA_TOPICS = {
  CHAT_EVENTS: "chat-events", // For all chat-related events (MessageSent, etc.)
} as const;
