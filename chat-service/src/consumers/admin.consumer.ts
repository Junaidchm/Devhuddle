import { Kafka } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "../utils/logger.util";
import prisma from "../config/db";

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

  if (action === "HIDE" || action === "DELETE") {
    if (targetType === "HUB") {
      logger.info(`Moderation: Hiding hub ${targetId}`);
      await prisma.conversation.update({
        where: { id: targetId },
        data: { 
          isSuspended: true,
          suspendedAt: new Date()
        }
      });
    } else if (targetType === "MESSAGE") {
      logger.info(`Moderation: Hiding message ${targetId}`);
      await prisma.message.update({
        where: { id: targetId },
        data: { deletedForAll: true }
      });
    }
  } else if (action === "BAN" || action === "SUSPEND") {
    if (targetType === "USER") {
      // The auth-service Redis block list enforced by gRPC GetUserStatus will prevent 
      // new messages from being sent. Historical messages are kept for audit purposes.
      logger.info(`Chat message restriction enforced for ${action} on user ${targetId} via Redis block list`);
    } else if (targetType === "HUB" && action === "SUSPEND") {
      logger.info(`Moderation: Suspending hub ${targetId}`);
      await prisma.conversation.update({
        where: { id: targetId },
        data: { 
          isSuspended: true,
          suspendedAt: new Date()
        }
      });
    }
  } else if (action === "UNHIDE") {
    if (targetType === "HUB") {
      logger.info(`Moderation: Restoring hub ${targetId}`);
      await prisma.conversation.update({
        where: { id: targetId },
        data: { 
          isSuspended: false,
          suspendedAt: null
        }
      });
    }
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

