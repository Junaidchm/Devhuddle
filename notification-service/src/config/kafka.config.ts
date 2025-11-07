export const KAFKA_TOPICS = {
  USER_FOLLOWED: "user-followed",
  USER_UNFOLLOWED: "user-unfollowed",
  USER_FOLLOWED_DLQ: "user-followed-dlq",
  USER_UNFOLLOWED_DLQ: "user-unfollowed-dlq",
  LIKE_ADDED: "like-added",
  LIKE_REMOVED: "like-removed",
  LIKE_ADDED_DLQ: "like-added-dlq",
  LIKE_REMOVED_DLQ: "like-removed-dlq",
  COMMENT_ADDED: "comment-added",
  COMMENT_ADDED_DLQ: "comment-added-dlq",
  NOTIFICATION_FAILED: "notification-failed",
  NOTIFICATION_FAILED_DLQ: "notification-failed-dlq",
} as const;

export const KAFKA_CONFIG = {
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  clientId: process.env.KAFKA_CLIENT_ID || "notification-service",
};
