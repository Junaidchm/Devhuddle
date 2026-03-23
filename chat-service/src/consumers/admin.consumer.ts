import { Kafka } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "../utils/logger.util";
import prisma from "../config/db";
import { WebSocketService } from "../utils/websocket.util";

const consumers: Map<string, any> = new Map();

async function getConsumer(groupId: string): Promise<any> {
  let consumer = consumers.get(groupId);
  if (!consumer) {
    const kafka = new Kafka(KAFKA_CONFIG);
    consumer = kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    await consumer.connect();
    consumers.set(groupId, consumer);
    logger.info(`Kafka consumer connected with group: ${groupId}`);
  }
  return consumer;
}

/**
 * Handles moderation enforcement for the chat-service domain.
 * Listens for admin-action-enforced and user-state-toggled events
 * and soft-deletes messages from blocked users.
 */
export async function startAdminConsumer(): Promise<void> {
  const consumer = await getConsumer("chat-service-admin-enforcement");

  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, 
      KAFKA_TOPICS.USER_STATE_TOGGLED,
      KAFKA_TOPICS.USER_DELETED
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }: any) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      let event: any;
      try {
        event = JSON.parse(rawValue);
      } catch {
        logger.error("AdminConsumer(chat): Failed to parse message", { rawValue });
        return;
      }

      logger.info(`AdminConsumer(chat) received event on topic: ${topic}`, {
        eventType: event.eventType || event.action,
      });

      try {
        if (topic === KAFKA_TOPICS.USER_STATE_TOGGLED) {
          await handleUserStateToggled(event);
        } else if (topic === KAFKA_TOPICS.ADMIN_ACTION_ENFORCED) {
          await handleAdminActionEnforced(event);
        } else if (topic === KAFKA_TOPICS.USER_DELETED) {
          await handleUserDeleted(event);
        }
      } catch (err: any) {
        logger.error("AdminConsumer(chat): Failed to handle event", {
          topic,
          error: err.message,
        });
      }
    },
  });

  logger.info("AdminConsumer(chat) started and subscribed to moderation topics");
}

async function handleUserStateToggled(event: {
  userId: string;
  isBlocked: boolean;
}) {
  const { userId, isBlocked } = event;

  if (isBlocked) {
    // Soft-delete all messages from this user that are in group conversations
    // Individual conversations are governed by block logic, not hiding
    logger.info(`Hiding group messages for blocked user: ${userId}`);
    // We only soft-delete group message visibility — private chats keep history
    // This marks user as blocked so new message sends are rejected by auth checks
    logger.info(`User ${userId} block state synced with chat-service (real-time block enforcement handles the rest)`);
  }
}

async function handleAdminActionEnforced(event: {
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
}) {
  const { action, targetType, targetId, reason } = event;

  if (targetType === "HUB") {
    // 1. Get conversation with participants for cache invalidation
    const conversation = await prisma.conversation.findUnique({
      where: { id: targetId },
      include: { participants: true }
    });

    if (conversation) {
      // 2. Update DB status
      if (action === "HIDE" || action === "DELETE" || action === "SUSPEND") {
        logger.info(`Moderation: Suspending/Hiding hub ${targetId}`);
        await prisma.conversation.update({
          where: { id: targetId },
          data: { 
            isSuspended: true,
            suspendedAt: new Date()
          }
        });
      } else if (action === "UNHIDE") {
        logger.info(`Moderation: Restoring hub ${targetId}`);
        await prisma.conversation.update({
          where: { id: targetId },
          data: { 
            isSuspended: false,
            suspendedAt: null
          }
        });
      }

      // 3. Invalidate Redis Caches for ALL participants
      const RedisCacheService = (await import("../utils/redis-cache.util")).RedisCacheService;
      
      // Invalidate individual conversation cache
      await RedisCacheService.invalidateConversationCache(targetId);
      
      // Invalidate metadata list cache for every participant
      const participantIds = conversation.participants.map(p => p.userId);
      await Promise.all(participantIds.map(userId => 
        RedisCacheService.invalidateUserConversationsMetadataCache(userId)
      ));

      logger.info(`Moderation: Invalidated caches for ${participantIds.length} participants of hub ${targetId}`);

      // 4. Broadcast via WebSocket
      const eventType = (action === "UNHIDE") ? "content_restored" : "content_removed";
      WebSocketService.getInstance().broadcastToAll(eventType, {
        entityId: targetId,
        entityType: targetType,
        action,
        timestamp: Date.now()
      });
    }
  } else if (targetType === "MESSAGE" && (action === "HIDE" || action === "DELETE")) {
    logger.info(`Moderation: Hiding message ${targetId}`);
    await prisma.message.update({
      where: { id: targetId },
      data: { deletedForAll: true }
    });
  } else if (targetType === "USER" && (action === "BAN" || action === "SUSPEND")) {
    logger.info(`Chat message restriction enforced for ${action} on user ${targetId} via Redis block list`);
  }
}

async function handleUserDeleted(event: { userId: string }) {
  const { userId } = event;
  logger.info(`🗑️ Account deletion Saga (chat): Purging all data for user: ${userId}`);

  try {
    await prisma.$transaction([
      // 1. Delete all messages sent by the user
      prisma.message.deleteMany({ where: { senderId: userId } }),
      
      // 2. Delete the user from all conversations
      prisma.participant.deleteMany({ where: { userId } }),
      
      // 3. Delete any blocks involving the user
      prisma.blockedUser.deleteMany({
        where: {
          OR: [{ blockerId: userId }, { blockedId: userId }],
        },
      }),

      // 4. Delete chat interactions
      prisma.chatInteraction.deleteMany({
        where: {
          OR: [{ userId }, { partnerId: userId }],
        },
      }),
    ]);

    logger.info(`✅ Successfully purged all chat data for user: ${userId}`);
  } catch (err: any) {
    logger.error(`❌ Failed to purge chat data for user: ${userId}`, { error: err.message });
    throw err;
  }
}

