// src/config/kafka.config.ts
export const KAFKA_TOPICS = {
  USER_FOLLOWED: 'user-followed',
  USER_UNFOLLOWED: 'user-unfollowed',
  USER_FOLLOWED_DLQ: 'user-followed-dlq',
  USER_UNFOLLOWED_DLQ: 'user-unfollowed-dlq',
  NOTIFICATION_FAILED: 'notification-failed',
  NOTIFICATION_FAILED_DLQ: 'notification-failed-dlq',
  ADMIN_ACTION_ENFORCED: 'admin-action-enforced',
  USER_STATE_TOGGLED: 'user-state-toggled',
  // Content Metrics (from Post Service)
  POST_CREATED: 'post.created.v1',
  POST_DELETED: 'post.deleted.v1',
  POST_COMMENT_CREATED: 'post.comment.created.v1',
  POST_COMMENT_DELETED: 'post.comment.deleted.v1',
  POST_LIKE_CREATED: 'post.like.created.v1',
  POST_LIKE_REMOVED: 'post.like.removed.v1',
  COMMENT_LIKE_CREATED: 'comment.like.created.v1',
  COMMENT_LIKE_REMOVED: 'comment.like.removed.v1',
  SHARE_CREATED: 'post.sent.v1',
} as const;

export const KAFKA_CONFIG = {
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  clientId: process.env.KAFKA_CLIENT_ID || 'user-service',
};
