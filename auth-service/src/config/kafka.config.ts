// src/config/kafka.config.ts
export const KAFKA_TOPICS = {
  USER_FOLLOWED: 'user-followed',
  USER_UNFOLLOWED: 'user-unfollowed',
  USER_FOLLOWED_DLQ: 'user-followed-dlq',
  USER_UNFOLLOWED_DLQ: 'user-unfollowed-dlq',
} as const;

export const KAFKA_CONFIG = {
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  clientId: process.env.KAFKA_CLIENT_ID || 'user-service',
};
