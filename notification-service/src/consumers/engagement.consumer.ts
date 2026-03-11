import { getConsumer } from "../utils/kafka.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import { NotificationsRepository } from "../repository/impliments/notifications.repository";
import redisClient from "../config/redis.config";
import logger from "../utils/logger.util";
import { WebSocketService } from "../utils/websocket.util";

const GROUP_ID = "notification-engagement-group";

// ========== EVENT TYPE DEFINITIONS ==========

interface BaseEngagementEvent {
  dedupeId: string;
  eventTimestamp: string;
  version: number;
  action: string;
  source?: string;
  timestamp?: string;
  retryCount?: number;
}

interface PostLikeCreatedEvent extends BaseEngagementEvent {
  postId: string;
  userId: string;
  postAuthorId: string;
  action: "LIKE" | "LIKE_RESTORED";
}

interface PostLikeRemovedEvent extends BaseEngagementEvent {
  postId: string;
  userId: string;
  postAuthorId: string;
  action: "UNLIKE";
}

interface CommentLikeCreatedEvent extends BaseEngagementEvent {
  commentId: string;
  userId: string;
  commentAuthorId: string;
  postId: string;
  action: "LIKE" | "LIKE_RESTORED";
}

interface CommentLikeRemovedEvent extends BaseEngagementEvent {
  commentId: string;
  userId: string;
  commentAuthorId: string;
  postId: string;
  action: "UNLIKE";
}

interface PostCommentCreatedEvent extends BaseEngagementEvent {
  commentId: string;
  postId: string;
  userId: string;
  postAuthorId: string;
  parentCommentId?: string;
  parentCommentAuthorId?: string;
  content: string;
  mentionedUserIds: string[];
  action: "COMMENT_CREATED";
}

interface PostCommentEditedEvent extends BaseEngagementEvent {
  commentId: string;
  postId: string;
  userId: string;
  content: string;
  action: "COMMENT_EDITED";
}

interface PostCommentDeletedEvent extends BaseEngagementEvent {
  commentId: string;
  postId: string;
  userId: string;
  action: "COMMENT_DELETED";
}

interface PostSentEvent extends BaseEngagementEvent {
  postId: string;
  senderId: string;
  recipientId: string;
  postAuthorId: string;
  message?: string;
  action: "POST_SENT" | "POST_SHARED";
}

// ✅ NEW: Post creation event (for fan-out notifications)
interface PostCreatedEvent extends BaseEngagementEvent {
  postId: string;
  userId: string; // Post author
  visibility: string; // "PUBLIC" | "VISIBILITY_CONNECTIONS"
  content?: string; // Preview
  createdAt: string;
  action: "POST_CREATED";
}

interface PostReportedEvent extends BaseEngagementEvent {
  reportId: string;
  postId?: string;
  commentId?: string;
  reporterId: string;
  postAuthorId?: string;
  commentAuthorId?: string;
  reason: string;
  severity?: string;
  reportCount?: number;
  description?: string;
  metadata?: any;
}

// ✅ NEW: Project event types
interface ProjectLikeCreatedEvent extends BaseEngagementEvent {
  projectId: string;
  userId: string;
  projectAuthorId: string;
  action: "LIKE" | "LIKE_RESTORED";
}

interface ProjectLikeRemovedEvent extends BaseEngagementEvent {
  projectId: string;
  userId: string;
  projectAuthorId: string;
  action: "UNLIKE";
}

interface ProjectCommentCreatedEvent extends BaseEngagementEvent {
  commentId: string;
  projectId: string;
  userId: string;
  projectAuthorId: string;
  parentCommentId?: string;
  parentCommentAuthorId?: string;
  content: string;
  action: "PROJECT_COMMENT_CREATED";
}

interface ProjectCommentEditedEvent extends BaseEngagementEvent {
  commentId: string;
  projectId: string;
  userId: string;
  content: string;
  action: "PROJECT_COMMENT_EDITED";
}

interface ProjectCommentDeletedEvent extends BaseEngagementEvent {
  commentId: string;
  projectId: string;
  userId: string;
  action: "PROJECT_COMMENT_DELETED";
}

interface ProjectShareCreatedEvent extends BaseEngagementEvent {
  shareId: string;
  projectId: string;
  userId: string;
  projectAuthorId: string;
  shareType: "SHARE" | "QUOTE";
  action: "PROJECT_SHARE_CREATED";
}

interface ProjectReportedEvent extends BaseEngagementEvent {
  reportId: string;
  projectId: string;
  reporterId: string;
  projectAuthorId: string;
  reason: string;
}

interface ProjectCommentLikeCreatedEvent extends BaseEngagementEvent {
  commentId: string;
  userId: string;
  commentAuthorId: string;
  projectId: string;
  action: "LIKE" | "LIKE_RESTORED";
}

interface ProjectCommentLikeRemovedEvent extends BaseEngagementEvent {
  commentId: string;
  userId: string;
  commentAuthorId: string;
  projectId: string;
  action: "UNLIKE";
}

export async function startEngagementConsumer(
  wsService: WebSocketService
): Promise<void> {
  // Pass wsService to repository (same pattern as follow.consumer.ts)
  const repo = new NotificationsRepository(wsService);
  const consumer = await getConsumer(GROUP_ID);

  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.POST_LIKE_CREATED,
      KAFKA_TOPICS.POST_LIKE_REMOVED,
      KAFKA_TOPICS.COMMENT_LIKE_CREATED,
      KAFKA_TOPICS.COMMENT_LIKE_REMOVED,
      KAFKA_TOPICS.POST_COMMENT_CREATED,
      KAFKA_TOPICS.POST_COMMENT_EDITED,
      KAFKA_TOPICS.POST_COMMENT_DELETED,
      KAFKA_TOPICS.POST_SENT,
      KAFKA_TOPICS.POST_REPORTED,
      KAFKA_TOPICS.USER_MENTIONED,
      KAFKA_TOPICS.POST_CREATED,
      KAFKA_TOPICS.PROJECT_LIKE_CREATED,
      KAFKA_TOPICS.PROJECT_LIKE_REMOVED,
      KAFKA_TOPICS.PROJECT_COMMENT_CREATED,
      KAFKA_TOPICS.PROJECT_COMMENT_EDITED,
      KAFKA_TOPICS.PROJECT_COMMENT_DELETED,
      KAFKA_TOPICS.PROJECT_SHARE_CREATED,
      KAFKA_TOPICS.PROJECT_REPORT_CREATED,
      KAFKA_TOPICS.PROJECT_COMMENT_LIKE_CREATED,
      KAFKA_TOPICS.PROJECT_COMMENT_LIKE_REMOVED,
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      try {
        const event = JSON.parse(message.value.toString()) as BaseEngagementEvent;
        
        // Ensure we have a dedupeId (fallback to generating one if missing from source)
        const dedupeId = event.dedupeId || `fallback-${topic}-${message.offset}`;
        const version = event.version || Date.now();

        // Idempotency check with safety
        if (dedupeId) {
          const isProcessed = await redisClient.sIsMember("processed-notifications", dedupeId);
          if (isProcessed) {
            logger.info(`Duplicate event skipped: ${dedupeId}`);
            return;
          }
        }

        // Mark as processing
        await redisClient.sAdd("processed-notifications", dedupeId);
        await redisClient.expire("processed-notifications", 3600);

        // Process based on topic with proper type casting
        switch (topic) {
          case KAFKA_TOPICS.POST_LIKE_CREATED:
            await handlePostLikeCreated(event as PostLikeCreatedEvent, repo);
            break;
          case KAFKA_TOPICS.POST_LIKE_REMOVED:
            await handlePostLikeRemoved(event as PostLikeRemovedEvent, repo);
            break;
          case KAFKA_TOPICS.COMMENT_LIKE_CREATED:
            await handleCommentLikeCreated(
              event as CommentLikeCreatedEvent,
              repo
            );
            break;
          case KAFKA_TOPICS.COMMENT_LIKE_REMOVED:
            await handleCommentLikeRemoved(
              event as CommentLikeRemovedEvent,
              repo
            );
            break;
          case KAFKA_TOPICS.POST_COMMENT_CREATED:
            await handlePostCommentCreated(
              event as PostCommentCreatedEvent,
              repo
            );
            break;
          case KAFKA_TOPICS.POST_COMMENT_EDITED:
            await handlePostCommentEdited(
              event as PostCommentEditedEvent,
              repo
            );
            break;
          case KAFKA_TOPICS.POST_COMMENT_DELETED:
            await handlePostCommentDeleted(
              event as PostCommentDeletedEvent,
              repo
            );
            break;
          case KAFKA_TOPICS.POST_SENT:
            await handlePostSent(event as PostSentEvent, repo);
            break;
          case KAFKA_TOPICS.POST_CREATED:
            await handlePostCreated(event as PostCreatedEvent, repo, wsService);
            break;
          case KAFKA_TOPICS.POST_REPORTED:
            await handlePostReported(event as PostReportedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_LIKE_CREATED:
            await handleProjectLikeCreated(event as ProjectLikeCreatedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_LIKE_REMOVED:
            await handleProjectLikeRemoved(event as ProjectLikeRemovedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_COMMENT_CREATED:
            await handleProjectCommentCreated(event as ProjectCommentCreatedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_COMMENT_EDITED:
            await handleProjectCommentEdited(event as ProjectCommentEditedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_COMMENT_DELETED:
            await handleProjectCommentDeleted(event as ProjectCommentDeletedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_SHARE_CREATED:
            await handleProjectShareCreated(event as ProjectShareCreatedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_REPORT_CREATED:
            await handleProjectReported(event as ProjectReportedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_COMMENT_LIKE_CREATED:
            await handleProjectCommentLikeCreated(event as ProjectCommentLikeCreatedEvent, repo);
            break;
          case KAFKA_TOPICS.PROJECT_COMMENT_LIKE_REMOVED:
            await handleProjectCommentLikeRemoved(event as ProjectCommentLikeRemovedEvent, repo);
            break;
          default:
            logger.warn(`Unhandled topic: ${topic}`);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Error processing engagement event`, {
          topic,
          offset: message.offset,
          error: errorMessage,
        });
      }
    },
  });
}

async function handlePostLikeCreated(
  event: PostLikeCreatedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { postId, userId, postAuthorId, version } = event;

  console.log(
    "the event is handlePostLikeCreated -------------------->",
    event
  );
  // Don't notify if user liked their own post
  if (userId === postAuthorId) return;

  const versionNumber = version || Date.now();

  // Repository handles broadcasting internally (no duplicate broadcast needed)
  await repo.createLikeNotification(
    userId,
    postAuthorId,
    postId,
    "POST",
    versionNumber,
    undefined, // contextId
    { postId } // metadata
  );

  logger.info(`Post like notification created for ${postAuthorId}`);
}

async function handlePostLikeRemoved(
  event: PostLikeRemovedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { postId, userId, postAuthorId, version } = event;

  if (userId === postAuthorId) return;

  const versionNumber = version || Date.now();

  await repo.deleteLikeNotification(
    userId,
    postAuthorId,
    postId,
    "POST",
    versionNumber
  );

  logger.info(`Post like notification removed for ${postAuthorId}`);
}

async function handleCommentLikeCreated(
  event: CommentLikeCreatedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { commentId, userId, commentAuthorId, postId, version } = event;

  if (userId === commentAuthorId) return;

  const versionNumber = version || Date.now();

  await repo.createLikeNotification(
    userId,
    commentAuthorId,
    commentId,
    "COMMENT",
    versionNumber,
    postId, // contextId
    { postId, commentId } // metadata
  );

  logger.info(`Comment like notification created for ${commentAuthorId}`);
}

async function handleCommentLikeRemoved(
  event: CommentLikeRemovedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { commentId, userId, commentAuthorId, version } = event;

  if (userId === commentAuthorId) return;

  const versionNumber = version || Date.now();

  await repo.deleteLikeNotification(
    userId,
    commentAuthorId,
    commentId,
    "COMMENT",
    versionNumber
  );

  logger.info(`Comment like notification removed for ${commentAuthorId}`);
}

async function handlePostCommentCreated(
  event: PostCommentCreatedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const {
    commentId,
    postId,
    userId,
    postAuthorId,
    parentCommentId,
    parentCommentAuthorId,
    mentionedUserIds,
    version,
  } = event;

  const versionNumber = version || Date.now();

  // Notify post author if commenter is not the post author
  if (userId !== postAuthorId) {
    await repo.createCommentNotification(
      userId,
      postAuthorId,
      postId,
      commentId,
      "POST",
      versionNumber
    );
    logger.info(`Comment notification created for post author ${postAuthorId}`);
  }

  // Notify parent comment author if this is a reply
  if (
    parentCommentId &&
    parentCommentAuthorId &&
    userId !== parentCommentAuthorId
  ) {
    await repo.createCommentNotification(
      userId,
      parentCommentAuthorId,
      postId,
      commentId,
      "COMMENT",
      versionNumber
    );
    logger.info(
      `Comment reply notification created for parent comment author ${parentCommentAuthorId}`
    );
  }

  // Notify mentioned users
  if (
    mentionedUserIds &&
    Array.isArray(mentionedUserIds) &&
    mentionedUserIds.length > 0
  ) {
    for (const mentionedUserId of mentionedUserIds) {
      if (userId !== mentionedUserId) {
        await repo.createMentionNotification(
          userId,
          mentionedUserId,
          postId,
          commentId,
          "COMMENT",
          versionNumber
        );
        logger.info(`Mention notification created for user ${mentionedUserId}`);
      }
    }
  }
}

async function handlePostCommentEdited(
  event: PostCommentEditedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { commentId, postId, userId, version } = event;

  const versionNumber = version || Date.now();

  // Typically no notification for edits (LinkedIn/Twitter don't notify on edits)
  // Optional: You can update existing notifications if needed
  logger.info(
    `Comment edited: ${commentId} on post ${postId} by user ${userId}`
  );
}

async function handlePostCommentDeleted(
  event: PostCommentDeletedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { commentId, postId, userId, version } = event;

  const versionNumber = version || Date.now();

  // Delete all notifications related to this comment (for all recipients)
  await repo.deleteCommentNotification(commentId, versionNumber);

  logger.info(`Comment notifications deleted for comment ${commentId}`);
}

// ✅ NEW: Handle post creation event (notify followers)
async function handlePostCreated(
  event: PostCreatedEvent,
  repo: NotificationsRepository,
  wsService: WebSocketService
): Promise<void> {
  const { postId, userId, visibility, version } = event;

  // Only notify followers for PUBLIC or VISIBILITY_CONNECTIONS posts
  if (visibility !== "PUBLIC" && visibility !== "VISIBILITY_CONNECTIONS") {
    logger.info(`Post ${postId} is private, skipping notifications`, {
      visibility,
    });
    return;
  }

  const versionNumber = version || Date.now();

  // TODO: Get followers from User Service via gRPC
  // For now, this is a placeholder - notifications will be sent once GetFollowers is implemented
  // The fan-out to feeds is already working in PostService
  logger.info(`Post created: ${postId} by user ${userId}`, {
    visibility,
    note: "Followers notification pending GetFollowers implementation",
  });

  // Once GetFollowers is implemented in User Service:
  // 1. Call GetFollowers(userId) to get follower list
  // 2. For each follower:
  //    await repo.createPostNotification(userId, followerId, postId, versionNumber);
  //    wsService.broadcastToUser(followerId, { type: 'NEW_POST', payload: { postId, authorId: userId } });
}

async function handlePostSent(
  event: PostSentEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { postId, senderId, recipientId, action, version } = event;

  // Don't notify if user sent/shared their own post to themselves
  if (senderId === recipientId) return;

  const versionNumber = version || Date.now();

  if (action === "POST_SHARED") {
    // Notify the original author about the share
    await repo.createShareNotification(senderId, recipientId, postId, versionNumber);
    logger.info(`Post share notification created for author ${recipientId} triggered by ${senderId}`, {
      postId,
      authorId: recipientId,
      sharerId: senderId,
      version: versionNumber
    });
  } else {
    // Create a notification for the recipient (direct send)
    await repo.createPostSentNotification(
      senderId,
      recipientId,
      postId,
      event.message,
      versionNumber
    );
    logger.info(`Post sent notification created for recipient ${recipientId} from ${senderId}`, {
      postId,
      recipientId,
      senderId,
      version: versionNumber
    });
  }
}

async function handlePostReported(
  event: PostReportedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { 
    postId, 
    commentId, 
    reporterId, 
    postAuthorId, 
    commentAuthorId, 
    reason, 
    version
  } = event;

  const recipientId = commentId ? commentAuthorId : postAuthorId;
  
  if (!recipientId) {
    logger.warn("Skipping report notification: recipientId not found", { event });
    return;
  }

  const versionNumber = version || Date.now();

  // Notify the author that their content was reported
  // In a real system, we might mask the reporterId or show "A user"
  await repo.createReportNotification(
    reporterId, // In production, consider using "System" or anonymizing
    recipientId,
    commentId || postId!,
    commentId ? "COMMENT" : "POST",
    reason,
    versionNumber,
    { postId, commentId }
  );

  logger.info(`Report notification sent to author ${recipientId}`, {
    target: commentId ? `Comment ${commentId}` : `Post ${postId}`,
    reason
  });
}

// ✅ NEW: Project Event Handlers

async function handleProjectLikeCreated(
  event: ProjectLikeCreatedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { projectId, userId, projectAuthorId, version } = event;

  if (userId === projectAuthorId) return;

  await repo.createLikeNotification(
    userId,
    projectAuthorId,
    projectId,
    "PROJECT" as any, // We'll update the repository to handle this
    version,
    undefined,
    { projectId }
  );

  logger.info(`Project like notification created for ${projectAuthorId}`);
}

async function handleProjectLikeRemoved(
  event: ProjectLikeRemovedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { projectId, userId, projectAuthorId, version } = event;

  if (userId === projectAuthorId) return;

  await repo.deleteLikeNotification(
    userId,
    projectAuthorId,
    projectId,
    "PROJECT" as any,
    version
  );

  logger.info(`Project like notification removed for ${projectAuthorId}`);
}

async function handleProjectCommentCreated(
  event: ProjectCommentCreatedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const {
    commentId,
    projectId,
    userId,
    projectAuthorId,
    parentCommentId,
    parentCommentAuthorId,
    version,
  } = event;

  // Notify project author
  if (userId !== projectAuthorId) {
    await repo.createCommentNotification(
      userId,
      projectAuthorId,
      projectId,
      commentId,
      "PROJECT" as any,
      version
    );
    logger.info(`Comment notification created for project author ${projectAuthorId}`);
  }

  // Notify parent comment author if reply
  if (parentCommentId && parentCommentAuthorId && userId !== parentCommentAuthorId) {
    await repo.createCommentNotification(
      userId,
      parentCommentAuthorId,
      projectId,
      commentId,
      "PROJECT_COMMENT" as any, // Comment replies for projects
      version
    );
    logger.info(`Comment reply notification created for parent comment author ${parentCommentAuthorId}`);
  }
}

async function handleProjectCommentEdited(
  event: ProjectCommentEditedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { commentId, projectId, userId } = event;
  logger.info(`Project comment edited: ${commentId} on project ${projectId} by user ${userId}`);
}

async function handleProjectCommentDeleted(
  event: ProjectCommentDeletedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { commentId, version } = event;
  await repo.deleteCommentNotification(commentId, version);
  logger.info(`Project comment notifications deleted for comment ${commentId}`);
}

async function handleProjectShareCreated(
  event: ProjectShareCreatedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { projectId, userId, projectAuthorId, version } = event;

  if (userId === projectAuthorId) return;

  await repo.createShareNotification(userId, projectAuthorId, projectId, version, "PROJECT" as any);
  logger.info(`Project share notification created for author ${projectAuthorId} by ${userId}`);
}

async function handleProjectReported(
  event: ProjectReportedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { reportId, projectId, reporterId, projectAuthorId, reason, version } = event;

  await repo.createReportNotification(
    reporterId,
    projectAuthorId,
    projectId,
    "PROJECT" as any,
    reason,
    version,
    { projectId }
  );

  logger.info(`Project report notification sent to author ${projectAuthorId}`, { reportId, reason });
}

async function handleProjectCommentLikeCreated(
  event: ProjectCommentLikeCreatedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { commentId, userId, commentAuthorId, projectId, version } = event;

  if (userId === commentAuthorId) return;

  const versionNumber = version || Date.now();

  await repo.createLikeNotification(
    userId,
    commentAuthorId,
    commentId,
    "COMMENT",
    versionNumber,
    projectId,
    { projectId, commentId }
  );

  logger.info(`Project comment like notification created for ${commentAuthorId}`);
}

async function handleProjectCommentLikeRemoved(
  event: ProjectCommentLikeRemovedEvent,
  repo: NotificationsRepository
): Promise<void> {
  const { commentId, userId, commentAuthorId, version } = event;

  if (userId === commentAuthorId) return;

  const versionNumber = version || Date.now();

  await repo.deleteLikeNotification(
    userId,
    commentAuthorId,
    commentId,
    "COMMENT",
    versionNumber
  );

  logger.info(`Project comment like notification removed for ${commentAuthorId}`);
}
