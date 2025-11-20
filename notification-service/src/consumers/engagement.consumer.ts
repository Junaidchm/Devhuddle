// import { getConsumer } from "../utils/kafka.util";
// import { KAFKA_TOPICS } from "../config/kafka.config";
// import { NotificationsRepository } from "../repository/impliments/notifications.repository";
// import redisClient from "../config/redis.config";
// import logger from "../utils/logger.util";
// import { WebSocketService } from "../utils/websocket.util";

// const GROUP_ID = "notification-engagement-group";
// const repo = new NotificationsRepository();

// export async function startEngagementConsumer(wsService: WebSocketService): Promise<void> {
//   const consumer = await getConsumer(GROUP_ID);

//   await consumer.subscribe({
//     topics: [
//       KAFKA_TOPICS.POST_LIKE_CREATED,
//       KAFKA_TOPICS.POST_LIKE_REMOVED,
//       KAFKA_TOPICS.COMMENT_LIKE_CREATED,
//       KAFKA_TOPICS.COMMENT_LIKE_REMOVED,
//       KAFKA_TOPICS.POST_COMMENT_CREATED,
//       KAFKA_TOPICS.POST_COMMENT_EDITED,
//       KAFKA_TOPICS.POST_COMMENT_DELETED,
//       KAFKA_TOPICS.POST_SHARED,
//       KAFKA_TOPICS.POST_REPORTED,
//       KAFKA_TOPICS.USER_MENTIONED,
//     ],
//     fromBeginning: false,
//   });

//   await consumer.run({
//     eachMessage: async ({ topic, message }) => {
//       if (!message.value) return;

//       const event = JSON.parse(message.value.toString());
//       const { dedupeId } = event;

//       // Idempotency check
//       if (await redisClient.sIsMember("processed-notifications", dedupeId)) {
//         logger.info(`Duplicate event skipped: ${dedupeId}`);
//         return;
//       }

//       try {
//         // Mark as processing
//         await redisClient.sAdd("processed-notifications", dedupeId);
//         await redisClient.expire("processed-notifications", 3600);

//         // Process based on topic
//         switch (topic) {
//           case KAFKA_TOPICS.POST_LIKE_CREATED:
//             await handlePostLikeCreated(event, wsService);
//             break;
//           case KAFKA_TOPICS.COMMENT_LIKE_CREATED:
//             await handleCommentLikeCreated(event, wsService);
//             break;
//           case KAFKA_TOPICS.POST_COMMENT_CREATED:
//             await handlePostCommentCreated(event, wsService);
//             break;
//           case KAFKA_TOPICS.POST_SHARED:
//             await handlePostShared(event, wsService);
//             break;
//           case KAFKA_TOPICS.USER_MENTIONED:
//             await handleUserMentioned(event, wsService);
//             break;
//           case KAFKA_TOPICS.POST_REPORTED:
//             await handlePostReported(event, wsService);
//             break;
//           default:
//             logger.warn(`Unhandled topic: ${topic}`);
//         }
//       } catch (error: any) {
//         logger.error(`Error processing engagement event`, {
//           topic,
//           error: error.message,
//           event,
//         });
//       }
//     },
//   });
// }

// async function handlePostLikeCreated(event: any, wsService: WebSocketService): Promise<void> {
//   const { postId, userId, postAuthorId } = event;
  
//   // Don't notify if user liked their own post
//   if (userId === postAuthorId) return;

//   await repo.createLikeNotification(userId, postAuthorId, postId, "POST");
//   wsService.sendNotification(postAuthorId, {
//     type: "POST_LIKED",
//     postId,
//     userId,
//     message: "Someone liked your post",
//   });

//   logger.info(`Post like notification created for ${postAuthorId}`);
// }

// async function handleCommentLikeCreated(event: any, wsService: WebSocketService): Promise<void> {
//   const { commentId, userId, commentAuthorId } = event;
  
//   if (userId === commentAuthorId) return;

//   await repo.createLikeNotification(userId, commentAuthorId, commentId, "COMMENT");
//   wsService.sendNotification(commentAuthorId, {
//     type: "COMMENT_LIKED",
//     commentId,
//     userId,
//     message: "Someone liked your comment",
//   });

//   logger.info(`Comment like notification created for ${commentAuthorId}`);
// }

// async function handlePostCommentCreated(event: any, wsService: WebSocketService): Promise<void> {
//   const { postId, userId, postAuthorId } = event;
  
//   if (userId === postAuthorId) return;

//   await repo.createCommentNotification(userId, postAuthorId, postId);
//   wsService.sendNotification(postAuthorId, {
//     type: "POST_COMMENTED",
//     postId,
//     userId,
//     message: "Someone commented on your post",
//   });

//   logger.info(`Post comment notification created for ${postAuthorId}`);
// }

// async function handlePostShared(event: any, wsService: WebSocketService): Promise<void> {
//   const { postId, userId, postAuthorId } = event;
  
//   if (userId === postAuthorId) return;

//   await repo.createShareNotification(userId, postAuthorId, postId);
//   wsService.sendNotification(postAuthorId, {
//     type: "POST_SHARED",
//     postId,
//     userId,
//     message: "Someone shared your post",
//   });

//   logger.info(`Post share notification created for ${postAuthorId}`);
// }

// async function handleUserMentioned(event: any, wsService: WebSocketService): Promise<void> {
//   const { mentionedUserId, actorId, postId, commentId } = event;
  
//   if (actorId === mentionedUserId) return;

//   await repo.createMentionNotification(actorId, mentionedUserId, postId, commentId);
//   wsService.sendNotification(mentionedUserId, {
//     type: "USER_MENTIONED",
//     postId,
//     commentId,
//     actorId,
//     message: "You were mentioned",
//   });

//   logger.info(`Mention notification created for ${mentionedUserId}`);
// }

// async function handlePostReported(event: any, wsService: WebSocketService): Promise<void> {
//   // Reports typically go to admins, not the post author
//   logger.info(`Post reported: ${event.postId} by ${event.reporterId}`);
//   // Implement admin notification logic here
// }