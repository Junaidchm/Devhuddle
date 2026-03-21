
import { getConsumer } from "../utils/kafka.util";
import logger from "../utils/logger.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import { NotificationService } from "../services/impliments/notification.service";
import { NotificationsRepository } from "../repository/impliments/notifications.repository";
import { WebSocketService } from "../utils/websocket.util";
import { EachMessagePayload } from "kafkajs";

// Define event payloads
interface MessageSentPayload {
  messageId: string;
  senderId: string;
  conversationId: string;
  content: string;
  type?: string; 
  timestamp: string;
  recipientIds: string[]; 
  replyToId?: string; // ✅ New: reply information
  replyToUserId?: string; // ✅ New: reply target
}

interface ReactionAddedPayload {
  messageId: string;
  senderId: string;
  conversationId: string;
  emoji: string;
  recipientIds: string[];
}

interface ReactionRemovedPayload {
  messageId: string;
  senderId: string;
  conversationId: string;
  emoji: string;
  recipientIds: string[];
}

interface MessageReportedPayload {
  messageId: string;
  reporterId: string;
  reason: string;
  reportedTargetId: string;
  content: string;
  timestamp: string;
}

interface HubJoinRequestedPayload {
  requestId: string;
  hubId: string;
  hubName: string; // ✅ New: For descriptive notifications
  requesterId: string;
  ownerId: string;
}

interface HubJoinApprovedPayload {
  requestId: string;
  hubId: string;
  hubName?: string; // ✅ New: Optional context
  requesterId: string;
  resolvedBy: string;
}

interface HubJoinRejectedPayload {
  requestId: string;
  hubId: string;
  hubName?: string; // ✅ Added for descriptive notification
  requesterId: string;
  resolvedBy: string;
}

export const startChatConsumer = async (wsService: WebSocketService) => {
  try {
    const consumer = await getConsumer('notification-service-chat-group');
    
    await consumer.subscribe({ topic: KAFKA_TOPICS.CHAT_EVENTS, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        try {
          const value = message.value?.toString();
          if (!value) return;

          const eventData = JSON.parse(value);
          const event = eventData.event || eventData.eventType;
          const payload = eventData;

          logger.info(`Received chat event: ${event}`, { payload });

          // Instantiate service with repository
          const notificationRepository = new NotificationsRepository(wsService);
          const notificationService = new NotificationService(notificationRepository);

          switch (event) {
            case 'MessageSent':
              await handleMessageSent(payload as MessageSentPayload, notificationService, wsService);
              break;
            case 'ReactionAdded':
              await handleReactionAdded(payload as ReactionAddedPayload, notificationService);
              break;
            case 'ReactionRemoved':
              await handleReactionRemoved(payload as ReactionRemovedPayload, notificationService);
              break;
            case 'MessageReported':
              await handleMessageReported(payload as MessageReportedPayload, notificationService, wsService);
              break;
            case 'HubJoinRequested':
              await handleHubJoinRequested(payload as HubJoinRequestedPayload, notificationService);
              break;
            case 'HubJoinApproved':
              await handleHubJoinApproved(payload as HubJoinApprovedPayload, notificationService);
              break;
            case 'HubJoinRejected':
              await handleHubJoinRejected(payload as HubJoinRejectedPayload, notificationService);
              break;
            default:
              logger.warn(`Unhandled chat event: ${event}`);
          }
        } catch (error) {
          logger.error('Error processing chat message', { error });
        }
      },
    });
    
    logger.info('Chat consumer started successfully');
  } catch (error) {
    logger.error('Error starting chat consumer', { error });
  }
};

async function handleMessageSent(
  payload: MessageSentPayload, 
  notificationService: NotificationService,
  wsService: WebSocketService
) {
  const { senderId, content, conversationId, recipientIds, messageId, type } = payload;

  if (!recipientIds || recipientIds.length === 0) {
      logger.warn('MessageSent event missing recipientIds, skipping notification');
      return;
  }

  // Create notifications for each recipient in parallel
  const notificationPromises = recipientIds.map(async (recipientId) => {
      try {
          // Handle SYSTEM messages (like group events)
          if (type === 'SYSTEM' || content === 'group_created' || content === 'participant_added') {
            await notificationService.createGroupAddedNotification(
              senderId,
              recipientId,
              conversationId,
              1 // version
            );
          } else {
            await notificationService.createChatNotification(
              senderId,
              recipientId,
              conversationId,
              messageId,
              content,
              1, // version
              type,
              payload.replyToId // ✅ New: Handle replies
            );
          }
      } catch (err) {
          logger.error(`Failed to create notification for user ${recipientId}`, { error: err });
      }
  });

  await Promise.all(notificationPromises);
}

async function handleReactionAdded(
  payload: ReactionAddedPayload,
  notificationService: NotificationService
) {
  const { senderId, conversationId, recipientIds, messageId, emoji } = payload;

  if (!recipientIds || recipientIds.length === 0) return;

  const notificationPromises = recipientIds.map(async (recipientId) => {
    try {
      await notificationService.createReactionNotification(
        senderId,
        recipientId,
        conversationId,
        messageId,
        emoji,
        1 // version
      );
    } catch (err) {
      logger.error(`Failed to create reaction notification for user ${recipientId}`, { error: err });
    }
  });

  await Promise.all(notificationPromises);
}

async function handleMessageReported(
    payload: MessageReportedPayload,
    notificationService: NotificationService,
    wsService: WebSocketService
) {
    logger.warn(`🚨 Message REPORTED: ${payload.messageId} by ${payload.reporterId} reason: ${payload.reason}`);
}

async function handleHubJoinRequested(
  payload: HubJoinRequestedPayload & { adminIds?: string[] },
  notificationService: NotificationService
) {
  const { requestId, hubId, requesterId, ownerId, adminIds } = payload;
  
  // Use adminIds if provided, fallback to ownerId for backward compatibility
  const targetIds = adminIds && adminIds.length > 0 ? adminIds : [ownerId];

  logger.info(`Processing HubJoinRequested for targets: ${targetIds.join(', ')}`);

  const notificationPromises = targetIds.map(async (targetId) => {
    try {
      await notificationService.createHubJoinRequestNotification(
        requesterId,
        targetId,
        hubId,
        requestId,
        1, // version
        payload.hubName // Pass hubName
      );
    } catch (err) {
      logger.error(`Failed to create HubJoinRequested notification for target ${targetId}`, { error: err });
    }
  });

  await Promise.all(notificationPromises);
}

async function handleHubJoinApproved(
  payload: HubJoinApprovedPayload,
  notificationService: NotificationService
) {
  const { requestId, hubId, requesterId, resolvedBy } = payload;
  try {
    await notificationService.createHubJoinApprovedNotification(
      resolvedBy,
      requesterId,
      hubId,
      requestId,
      1, // version
      payload.hubName // Pass hubName
    );
  } catch (err) {
    logger.error(`Failed to create HubJoinApproved notification for user ${requesterId}`, { error: err });
  }
}

async function handleHubJoinRejected(
  payload: HubJoinRejectedPayload,
  notificationService: NotificationService
) {
  const { requestId, hubId, requesterId, resolvedBy } = payload;
  try {
    await notificationService.createHubJoinRejectedNotification(
      resolvedBy,
      requesterId,
      hubId,
      requestId,
      1,
      payload.hubName // ✅ Pass hubName for descriptive message
    );
  } catch (err) {
    logger.error(`Failed to create HubJoinRejected notification for user ${requesterId}`, { error: err });
  }
}

async function handleReactionRemoved(
  payload: any,
  notificationService: NotificationService
) {
  const { senderId, conversationId, recipientIds, messageId, emoji } = payload;

  if (!recipientIds || recipientIds.length === 0) return;

  const notificationPromises = recipientIds.map(async (recipientId: string) => {
    try {
      await notificationService.deleteReactionNotification(
        senderId,
        recipientId,
        messageId,
        emoji,
        1
      );
    } catch (err) {
      logger.error(`Failed to delete reaction notification for user ${recipientId}`, { error: err });
    }
  });

  await Promise.all(notificationPromises);
}
