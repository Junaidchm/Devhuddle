import { Kafka } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "../utils/logger.util";
import { prisma } from "../config/prisma.config";

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
 * Handles moderation enforcement for the project-service domain.
 * Listens for admin-action-enforced and user-state-toggled events.
 *
 * Note: Project schema uses removedAt for soft-deletes (not isHidden).
 * ProjectComment schema also only has deletedAt.
 */
export async function startAdminConsumer(): Promise<void> {
  const consumer = await getConsumer("project-service-admin-enforcement");

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
        logger.error("AdminConsumer(project): Failed to parse message", { rawValue });
        return;
      }

      logger.info(`AdminConsumer(project) received event on topic: ${topic}`, {
        action: event.action,
        targetType: event.targetType,
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
        logger.error("AdminConsumer(project): Failed to handle event", {
          topic,
          error: err.message,
          event,
        });
      }
    },
  });

  logger.info("AdminConsumer(project) started and subscribed to moderation topics");
}

/**
 * When a user is blocked/unblocked, remove or restore their projects.
 * Uses removedAt for soft-delete (project schema pattern).
 * Comments use deletedAt.
 */
async function handleUserStateToggled(event: {
  userId: string;
  isBlocked: boolean;
  reason?: string;
}) {
  const { userId, isBlocked, reason = "Account moderation" } = event;

  if (isBlocked) {
    logger.info(`Soft-removing all projects and comments for blocked user: ${userId}`);
    await prisma.$transaction([
      // Mark projects as removed
      (prisma as any).project.updateMany({
        where: { userId, deletedAt: null },
        data: { removedAt: new Date(), removedBy: "admin-enforcement" },
      }),
      // Soft-delete project comments
      (prisma as any).projectComment.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);
  } else {
    logger.info(`Restoring projects and comments for unblocked user: ${userId}`);
    await prisma.$transaction([
      // Restore removed-by-enforcement projects
      (prisma as any).project.updateMany({
        where: { userId, removedBy: "admin-enforcement" },
        data: { removedAt: null, removedBy: null },
      }),
      // Note: Comments are kept soft-deleted for safety
    ]);
  }
}

/**
 * Handle specific admin enforcement actions targeting projects or users.
 */
async function handleAdminActionEnforced(event: {
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
}) {
  const { action, targetType, targetId } = event;

  if (action === "HIDE" || action === "BAN" || action === "SUSPEND") {
    if (targetType === "PROJECT") {
      logger.info(`Soft-removing project: ${targetId}`);
      await (prisma as any).project.update({
        where: { id: targetId },
        data: { removedAt: new Date(), removedBy: "admin-enforcement" },
      });
    } else if (targetType === "USER") {
      logger.info(`Soft-removing all projects for ${action} user: ${targetId}`);
      await (prisma as any).project.updateMany({
        where: { userId: targetId, deletedAt: null },
        data: { removedAt: new Date(), removedBy: "admin-enforcement" },
      });
    }
  }
}

async function handleUserDeleted(event: { userId: string }) {
  const { userId } = event;
  logger.info(`🗑️ Account deletion Saga (project): Purging all data for user: ${userId}`);

  try {
    await prisma.$transaction([
      // 1. Delete all project likes by user
      (prisma as any).projectLike.deleteMany({ where: { userId } }),

      // 2. Delete all project comments by user
      (prisma as any).projectComment.deleteMany({ where: { userId } }),

      // 3. Delete all comment reactions by user
      (prisma as any).projectCommentReaction.deleteMany({ where: { userId } }),

      // 4. Delete all project shares by user
      (prisma as any).projectShare.deleteMany({ where: { userId } }),

      // 5. Delete all project reports by user
      (prisma as any).projectReport.deleteMany({ where: { reporterId: userId } }),

      // 6. Delete all project analytics by user
      (prisma as any).projectAnalytics.deleteMany({ where: { userId } }),

      // 7. Delete all idempotency keys by user
      (prisma as any).idempotencyKey.deleteMany({ where: { userId } }),

      // 8. Delete all projects by user (cascades to Media, Versions, etc.)
      (prisma as any).project.deleteMany({ where: { userId } }),
    ]);

    logger.info(`✅ Successfully purged all project data for user: ${userId}`);
  } catch (err: any) {
    logger.error(`❌ Failed to purge project data for user: ${userId}`, { error: err.message });
    throw err;
  }
}

