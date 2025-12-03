import { KafkaConfig } from "kafkajs";

export const KAFKA_CONFIG: KafkaConfig = {
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  clientId: process.env.KAFKA_CLIENT_ID || "project-service",
  retry: {
    initialRetryTime: 100,
    retries: 5,
    maxRetryTime: 30000,
  },
};

export const KAFKA_TOPICS = {
  // Project events
  PROJECT_CREATED: "project.created.v1",
  PROJECT_UPDATED: "project.updated.v1",
  PROJECT_PUBLISHED: "project.published.v1",
  PROJECT_DELETED: "project.deleted.v1",
  PROJECT_CREATED_DLQ: "project.created.v1-dlq",
  PROJECT_UPDATED_DLQ: "project.updated.v1-dlq",
  PROJECT_PUBLISHED_DLQ: "project.published.v1-dlq",
  PROJECT_DELETED_DLQ: "project.deleted.v1-dlq",
  
  // Project like events
  PROJECT_LIKE_CREATED: "project.like.created.v1",
  PROJECT_LIKE_REMOVED: "project.like.removed.v1",
  PROJECT_LIKE_CREATED_DLQ: "project.like.created.v1-dlq",
  PROJECT_LIKE_REMOVED_DLQ: "project.like.removed.v1-dlq",
  
  // Project comment events
  PROJECT_COMMENT_CREATED: "project.comment.created.v1",
  PROJECT_COMMENT_EDITED: "project.comment.edited.v1",
  PROJECT_COMMENT_DELETED: "project.comment.deleted.v1",
  PROJECT_COMMENT_CREATED_DLQ: "project.comment.created.v1-dlq",
  PROJECT_COMMENT_EDITED_DLQ: "project.comment.edited.v1-dlq",
  PROJECT_COMMENT_DELETED_DLQ: "project.comment.deleted.v1-dlq",
  
  // Project share events
  PROJECT_SHARE_CREATED: "project.share.created.v1",
  PROJECT_SHARE_CREATED_DLQ: "project.share.created.v1-dlq",
  
  // Project report events
  PROJECT_REPORT_CREATED: "project.report.created.v1",
  PROJECT_REPORT_CREATED_DLQ: "project.report.created.v1-dlq",
  
  // Project media events
  PROJECT_MEDIA_UPLOADED: "project.media.uploaded.v1",
  PROJECT_MEDIA_PROCESSED: "project.media.processed.v1",
  PROJECT_MEDIA_UPLOADED_DLQ: "project.media.uploaded.v1-dlq",
  PROJECT_MEDIA_PROCESSED_DLQ: "project.media.processed.v1-dlq",
} as const;

