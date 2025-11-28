import { object } from "zod";
import prisma from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { BaseRepository } from "./base.repository";
import {
  NotificationObject,
  Prisma,
  NotificationType,
  EntityType,
} from "@prisma/client";
import redisClient from "../../config/redis.config";
import { WebSocketService } from "../../utils/websocket.util";
import { INotificationRepository } from "../interface/INotificationRepository";

export class NotificationsRepository
  extends BaseRepository<
    typeof prisma.notificationObject,
    NotificationObject,
    Prisma.NotificationObjectCreateInput,
    Prisma.NotificationObjectUpdateInput,
    Prisma.NotificationObjectWhereUniqueInput
  >
  implements INotificationRepository
{
  private wsService: WebSocketService | null = null;

  constructor(wsService?: WebSocketService) {
    super(prisma.notificationObject);
    if (wsService) this.wsService = wsService;
  }

  /**
   * Create like notification with aggregation
   * Uses generic _createOrUpdateNotification method
   */
  async createLikeNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT",
    version: number
  ): Promise<void> {
    await this._createOrUpdateNotification(
      NotificationType.LIKE,
      entityType === "POST" ? EntityType.POST : EntityType.COMMENT,
      entityId,
      issuerId,
      recipientId,
      version,
      "liked"
    );
  }

  async getLikeNotification(
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT"
  ): Promise<NotificationObject | null> {
    try {
      const notification = await prisma.notificationRecipient.findFirst({
        where: {
          recipientId,
          deletedAt: null,
          notificationObject: {
            type: NotificationType.LIKE,
            entityType:
              entityType === "POST" ? EntityType.POST : EntityType.COMMENT,
            entityId,
          },
        },
        include: {
          notificationObject: {
            include: {
              actors: true,
            },
          },
        },
      });

      return notification?.notificationObject || null;
    } catch (error: any) {
      logger.error("Error getting like notification", {
        error: error.message,
        recipientId,
        entityId,
      });
      return null;
    }
  }

  /**
   * Delete like notification with aggregation
   * Uses generic _removeNotificationActor method
   */
  async deleteLikeNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT",
    version: number
  ): Promise<void> {
    await this._removeNotificationActor(
      NotificationType.LIKE,
      entityType === "POST" ? EntityType.POST : EntityType.COMMENT,
      entityId,
      issuerId,
      recipientId,
      version,
      "liked"
    );
  }

  /**
   * Create comment notification with aggregation
   * Uses generic _createOrUpdateNotification method
   */
  async createCommentNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    commentId: string,
    notificationType: "POST" | "COMMENT",
    version: number
  ): Promise<void> {
    await this._createOrUpdateNotification(
      NotificationType.COMMENT,
      notificationType === "POST" ? EntityType.POST : EntityType.COMMENT,
      commentId, // Entity ID is the commentId
      issuerId,
      recipientId,
      version,
      notificationType === "POST"
        ? "commented on your post"
        : "replied to your comment"
    );
  }

  /**
   * Create mention notification
   * Uses generic _createOrUpdateNotification method
   * Mentions are typically 1:1 but we use aggregation pattern for consistency
   */
  async createMentionNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    commentId: string,
    entityType: "POST" | "COMMENT",
    version: number
  ): Promise<void> {
    await this._createOrUpdateNotification(
      NotificationType.MENTION,
      entityType === "POST" ? EntityType.POST : EntityType.COMMENT,
      commentId || postId, // Use commentId if exists, otherwise postId
      issuerId,
      recipientId,
      version,
      "mentioned you in a comment"
    );
  }

  /**
   * Delete comment notification for ALL recipients
   * When a comment is deleted, all notifications about it (COMMENT and MENTION) should be removed
   * Uses generic _deleteNotificationByEntity method
   */
  async deleteCommentNotification(
    commentId: string,
    version: number
  ): Promise<void> {
    // Delete COMMENT notifications related to this comment
    await this._deleteNotificationByEntity(
      NotificationType.COMMENT,
      EntityType.COMMENT,
      commentId,
      version
    );

    // Also delete MENTION notifications related to this comment
    await this._deleteNotificationByEntity(
      NotificationType.MENTION,
      EntityType.COMMENT,
      commentId,
      version
    );
  }

  /**
   * Create or update follow notification with aggregation
   * Uses generic _createOrUpdateNotification method
   */
  async createFollowNotification(
    issuerId: string,
    recipientId: string,
    version: number
  ): Promise<void> {
    await this._createOrUpdateNotification(
      NotificationType.FOLLOW,
      EntityType.USER,
      recipientId, // For FOLLOW, entityId is the recipientId (the user being followed)
      issuerId,
      recipientId,
      version,
      "followed"
    );
  }

  /**
   * Delete follow notification with aggregation
   */
  /**
   * Delete follow notification with aggregation
   * Uses generic _removeNotificationActor method
   * Note: Follow notifications may not have version in delete events, using current timestamp
   */
  async deleteFollowNotification(
    issuerId: string,
    recipientId: string,
    version?: number
  ): Promise<void> {
    await this._removeNotificationActor(
      NotificationType.FOLLOW,
      EntityType.USER,
      recipientId, // For FOLLOW, entityId is the recipientId
      issuerId,
      recipientId,
      version || Date.now(), // Use provided version or current timestamp
      "followed"
    );
  }

  /**
   * Get notifications with pagination and caching
   */
  async getNotifications(
    recipientId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    notifications: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Try cache first
      const cacheKey = `notifications:${recipientId}:${limit}:${offset}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info(`Returning cached notifications for user ${recipientId}`);
        return JSON.parse(cached);
      }

      const [notifications, total] = await Promise.all([
        prisma.notificationRecipient.findMany({
          where: {
            recipientId,
            deletedAt: null,
          },
          include: {
            notificationObject: {
              include: {
                actors: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.notificationRecipient.count({
          where: {
            recipientId,
            deletedAt: null,
          },
        }),
      ]);

      const result = {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.notificationObject.type,
          entityType: n.notificationObject.entityType,
          entityId: n.notificationObject.entityId,
          contextId: n.notificationObject.contextId,
          summary: n.notificationObject.summary,
          metadata: n.notificationObject.metadata,
          aggregatedCount: n.notificationObject.aggregatedCount,
          read: n.read,
          readAt: n.readAt,
          createdAt: n.createdAt,
          actors: n.notificationObject.actors.map((a) => a.actorId),
        })),
        total,
        hasMore: offset + limit < total,
      };

      // Cache for 5 minutes
      await redisClient.setEx(cacheKey, 300, JSON.stringify(result));

      return result;
    } catch (error: any) {
      logger.error("Error fetching notifications", {
        error: (error as Error).message,
        recipientId,
      });
      throw new Error("Database error");
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, recipientId: string): Promise<void> {
    try {
      await prisma.notificationRecipient.updateMany({
        where: {
          id: notificationId,
          recipientId,
          deletedAt: null,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      // Update cache
      await this._updateAndBroadcastUnreadCount(recipientId);

      logger.info(
        `Notification ${notificationId} marked as read for user ${recipientId}`
      );
    } catch (error: any) {
      logger.error("Error marking notification as read", {
        error: (error as Error).message,
        notificationId,
        recipientId,
      });
      throw new Error("Database error");
    }
  }

  /**
   * Soft delete notification
   */
  async deleteNotification(
    notificationId: string,
    recipientId: string
  ): Promise<void> {
    try {
      await prisma.notificationRecipient.updateMany({
        where: {
          id: notificationId,
          recipientId,
        },
        data: { deletedAt: new Date() },
      });

      // Update cache
      await this._updateAndBroadcastUnreadCount(recipientId);

      logger.info(
        `Notification ${notificationId} deleted for user ${recipientId}`
      );
    } catch (error: any) {
      logger.error("Error deleting notification", {
        error: (error as Error).message,
        notificationId,
        recipientId,
      });
      throw new Error("Database error");
    }
  }

  /**
   * Get unread count with caching
   */
  async getUnreadCount(recipientId: string): Promise<number> {
    try {
      // Try cache first
      const cacheKey = `notifications:unread:${recipientId}`;
      const cached = await redisClient.get(cacheKey);
      if (cached !== null) {
        console.log(
          "this is the cached value -----------------------------------",
          cached
        );
        return parseInt(cached, 10);
      }

      const count = await prisma.notificationRecipient.count({
        where: {
          recipientId,
          read: false,
          deletedAt: null,
        },
      });

      // Cache for 1 hour
      await redisClient.setEx(cacheKey, 3600, count.toString());

      return count;
    } catch (error: any) {
      logger.error("Error getting unread count", {
        error: (error as Error).message,
        recipientId,
      });
      return 0;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(recipientId: string): Promise<void> {
    try {
      await prisma.notificationRecipient.updateMany({
        where: {
          recipientId,
          read: false,
          deletedAt: null,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      // Update cache
      await this._updateAndBroadcastUnreadCount(recipientId);

      logger.info(`All notifications marked as read for user ${recipientId}`);
    } catch (error: any) {
      logger.error("Error marking all notifications as read", {
        error: (error as Error).message,
        recipientId,
      });
      throw new Error("Database error");
    }
  }

  /**
   * Update unread count cache
   */
  private async _updateAndBroadcastUnreadCount(
    recipientId: string
  ): Promise<void> {
    try {
      // console.log("this is the notification for the user ", notification);
      const count = await prisma.notificationRecipient.count({
        where: {
          recipientId,
          read: false,
          deletedAt: null,
        },
      });

      console.log(
        "this is the count for unread notification ------------------------->",
        count
      );
      const cacheKey = `notifications:unread:${recipientId}`;
      await redisClient.setEx(cacheKey, 3600, count.toString());

      // Broadcast the updated count
      this.wsService?.broadcastUnreadCount(recipientId, count);
    } catch (error) {
      logger.error("Error updating unread count cache", { error, recipientId });
    }
  }

  /**
   * Generic method to create or update any notification type
   * This eliminates code duplication across LIKE, COMMENT, FOLLOW, MENTION, etc.
   */
  private async _createOrUpdateNotification(
    notificationType: NotificationType,
    entityType: EntityType,
    entityId: string,
    issuerId: string,
    recipientId: string,
    version: number,
    actionVerb: string // e.g., "liked", "commented", "followed", "mentioned"
  ): Promise<void> {
    try {
      let notificationObject = null;

      // Find existing notification
      const existingObject = await prisma.notificationObject.findFirst({
        where: {
          type: notificationType,
          entityType,
          entityId,
        },
        include: { actors: true, recipients: true },
      });

      // Version check: ignore out-of-order events
      const versionBigInt = BigInt(version);
      if (existingObject && versionBigInt <= existingObject.version) {
        logger.info(`Ignoring out-of-order ${notificationType} event`, {
          entityId,
          eventVersion: version,
          currentVersion: existingObject.version.toString(),
        });
        return;
      }

      if (existingObject) {
        // Update existing notification (aggregation)
        const updatedCount = existingObject.actors.length + 1;
        const existingActors = existingObject.actors.map((a) => a.actorId);

        // Only add if actor doesn't exist
        if (!existingActors.includes(issuerId)) {
          notificationObject = await prisma.notificationObject.update({
            where: { id: existingObject.id },
            data: {
              aggregatedCount: updatedCount,
              version: versionBigInt,
              summary: {
                json: {
                  actors: [...existingActors, issuerId].slice(0, 3), // Keep top 3 for summary
                  count: updatedCount,
                  text: this._generateSummaryText(
                    [...existingActors, issuerId],
                    updatedCount,
                    actionVerb
                  ),
                },
              },
            },
          });

          // Add new actor
          await prisma.notificationActor.create({
            data: {
              notificationObjectId: existingObject.id,
              actorId: issuerId,
            },
          });

          // Upsert recipient
          await prisma.notificationRecipient.upsert({
            where: {
              recipientId_notificationObjectId: {
                recipientId,
                notificationObjectId: existingObject.id,
              },
            },
            create: {
              notificationObjectId: existingObject.id,
              recipientId,
            },
            update: {
              deletedAt: null,
              read: false,
              readAt: null,
            },
          });
        } else {
          // Actor already exists, just update recipient
          notificationObject = existingObject;
          await prisma.notificationRecipient.upsert({
            where: {
              recipientId_notificationObjectId: {
                recipientId,
                notificationObjectId: existingObject.id,
              },
            },
            create: {
              notificationObjectId: existingObject.id,
              recipientId,
            },
            update: {
              deletedAt: null,
              read: false,
              readAt: null,
            },
          });
        }
      } else {
        // Create new notification object
        notificationObject = await prisma.notificationObject.create({
          data: {
            type: notificationType,
            entityType,
            entityId,
            aggregatedCount: 1,
            version: versionBigInt as any,
            summary: {
              json: {
                actors: [issuerId],
                count: 1,
                text: this._generateSummaryText([issuerId], 1, actionVerb),
              },
            },
          },
        });

        // Create actor
        await prisma.notificationActor.create({
          data: {
            notificationObjectId: notificationObject.id,
            actorId: issuerId,
          },
        });

        // Create recipient
        await prisma.notificationRecipient.create({
          data: {
            notificationObjectId: notificationObject.id,
            recipientId,
          },
        });
      }

      // Broadcast the notification
      if (notificationObject) {
        this.wsService?.broadcastNotification(recipientId, notificationObject);
        await this._updateAndBroadcastUnreadCount(recipientId);
      }

      logger.info(
        `${notificationType} notification created/updated for ${recipientId}`
      );
    } catch (error: any) {
      logger.error(`Error creating/updating ${notificationType} notification`, {
        error: error.message,
        issuerId,
        recipientId,
        entityId,
      });
      throw new Error("Database error");
    }
  }

  /**
   * Generic method to delete/remove actor from notification
   */
  private async _removeNotificationActor(
    notificationType: NotificationType,
    entityType: EntityType,
    entityId: string,
    issuerId: string,
    recipientId: string,
    version: number,
    actionVerb: string
  ): Promise<void> {
    try {
      const existing = await prisma.notificationObject.findFirst({
        where: {
          type: notificationType,
          entityType,
          entityId,
        },
        include: { actors: true },
      });

      if (!existing) return;

      // Version check: ignore out-of-order events
      const versionBigInt = BigInt(version);
      if (versionBigInt <= existing.version) {
        logger.info(`Ignoring out-of-order ${notificationType} removal event`, {
          entityId,
          eventVersion: version,
          currentVersion: existing.version.toString(),
        });
        return;
      }

      // Remove the actor
      await prisma.notificationActor.deleteMany({
        where: {
          notificationObjectId: existing.id,
          actorId: issuerId,
        },
      });

      const remainingActorsCount = await prisma.notificationActor.count({
        where: {
          notificationObjectId: existing.id,
        },
      });

      if (remainingActorsCount === 0) {
        // Soft delete the entire notification
        await prisma.notificationRecipient.updateMany({
          where: {
            recipientId,
            notificationObjectId: existing.id,
          },
          data: {
            deletedAt: new Date(),
          },
        });
      } else {
        // Update aggregation
        const remainingActors = await prisma.notificationActor.findMany({
          where: {
            notificationObjectId: existing.id,
          },
          select: { actorId: true },
        });

        await super.update(existing.id, {
          aggregatedCount: remainingActorsCount,
          version: versionBigInt as any,
          summary: {
            json: {
              actors: remainingActors.map((a) => a.actorId).slice(0, 3),
              count: remainingActorsCount,
              text: this._generateSummaryText(
                remainingActors.map((a) => a.actorId),
                remainingActorsCount,
                actionVerb
              ),
            },
          },
        });

        await this._updateAndBroadcastUnreadCount(recipientId);
      }

      logger.info(
        `${notificationType} notification actor removed for recipient ${recipientId}`
      );
    } catch (error: any) {
      logger.error(`Error removing ${notificationType} notification actor`, {
        error: error.message,
        issuerId,
        recipientId,
        entityId,
      });
      throw new Error("Database error");
    }
  }

  /**
   * Generic method to delete all notifications by entityId for ALL recipients
   * Used when an entity (like a comment) is deleted and all notifications about it should be removed
   */
  private async _deleteNotificationByEntity(
    notificationType: NotificationType,
    entityType: EntityType,
    entityId: string,
    version: number
  ): Promise<void> {
    try {
      // Find ALL notification objects for this entity
      const notifications = await prisma.notificationObject.findMany({
        where: {
          type: notificationType,
          entityType,
          entityId,
        },
        include: { recipients: true },
      });

      if (notifications.length === 0) {
        logger.info(
          `No ${notificationType} notifications found for entity ${entityId}`
        );
        return;
      }

      // Collect all unique recipient IDs for unread count updates
      const allRecipientIds = new Set<string>();

      for (const notification of notifications) {
        // Version check for each notification
        const versionBigInt = BigInt(version);
        if (versionBigInt <= notification.version) {
          logger.info(`Ignoring out-of-order deletion event`, {
            entityId,
            notificationId: notification.id,
            eventVersion: version,
            currentVersion: notification.version.toString(),
          });
          continue;
        }

        // Collect all recipient IDs (only active ones)
        notification.recipients.forEach((recipient) => {
          if (!recipient.deletedAt) {
            allRecipientIds.add(recipient.recipientId);
          }
        });

        // Soft delete ALL recipients of this notification
        await prisma.notificationRecipient.updateMany({
          where: {
            notificationObjectId: notification.id,
            deletedAt: null, // Only delete active recipients
          },
          data: {
            deletedAt: new Date(),
          },
        });
      }

      // Update unread counts for ALL affected recipients
      for (const recipientId of allRecipientIds) {
        await this._updateAndBroadcastUnreadCount(recipientId);
      }

      logger.info(
        `Deleted ${notifications.length} ${notificationType} notification(s) for entity ${entityId} affecting ${allRecipientIds.size} recipients`
      );
    } catch (error: any) {
      logger.error("Error deleting notifications by entity", {
        error: error.message,
        entityId,
        notificationType,
        entityType,
      });
      throw new Error("Database error");
    }
  }

  /**
   * Generate summary text for aggregated notifications
   */
  private _generateSummaryText(
    actors: string[],
    count: number,
    action: string
  ): string {
    if (count === 1) {
      return `${actors[0]} ${action} you`;
    } else if (count === 2) {
      return `${actors[0]} and ${actors[1]} ${action} you`;
    } else {
      return `${actors[0]} and ${count - 1} others ${action} you`;
    }
  }
}
