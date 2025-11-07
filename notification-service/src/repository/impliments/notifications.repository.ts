import { object } from "zod";
import prisma from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { BaseRepository } from "./base.repository";
import { NotificationObject, Prisma } from "@prisma/client";
import redisClient from "../../config/redis.config";
import { WebSocketService } from "../../utils/websocket.util";

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
   * Create or update follow notification with aggregation
   */
  async createFollowNotification(
    issuerId: string,
    recipientId: string,
    version: number
  ): Promise<void> {
    try {
      let notifiationObject = null;

      const existingObject = await prisma.notificationObject.findFirst({
        where: {
          type: "FOLLOW",
          entityType: "USER",
          entityId: recipientId,
        },
        include: { actors: true, recipients: true },
      });

      if (existingObject) {
        const updatedCount = existingObject.actors.length + 1;
        const existingActors = existingObject.actors.map((a) => a.actorId);

        if (!existingActors.includes(issuerId)) {
          notifiationObject = await prisma.notificationObject.update({
            where: { id: existingObject.id },
            data: {
              aggregatedCount: updatedCount,
              summary: {
                json: {
                  actors: [...existingActors, issuerId],
                  count: updatedCount,
                  text: this._generateSummaryText(
                    [...existingActors, issuerId],
                    updatedCount,
                    "followed"
                  ),
                },
              },
              version,
            },
          });

          await prisma.notificationActor.create({
            data: {
              notificationObjectId: existingObject.id,
              actorId: issuerId,
            },
          });

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
        const notifiationObject = await prisma.notificationObject.create({
          data: {
            type: "FOLLOW",
            entityType: "USER",
            entityId: recipientId,
            aggregatedCount: 1,
            summary: {
              json: {
                actors: [issuerId],
                count: 1,
                text: `${issuerId} followed you`,
              },
            },
            version,
          },
        });

        await prisma.notificationActor.create({
          data: {
            notificationObjectId: notifiationObject.id,
            actorId: issuerId,
          },
        });

        await prisma.notificationRecipient.create({
          data: {
            notificationObjectId: notifiationObject.id,
            recipientId,
          },
        });

        // Broadcast the new notification
        // this.wsService?.broadcastNotification(recipientId, newNotification);
      }

      console.log(
        "this is the recipient id of the following action ------------------------>",
        recipientId
      );

      // Broadcast the new notification
      this.wsService?.broadcastNotification(recipientId, notifiationObject);
      // Update unread count cache
      await this._updateAndBroadcastUnreadCount(recipientId);

      logger.info(
        `Follow notification processed for recipient ${recipientId} `
      );
    } catch (error: any) {
      logger.error("Error creating follow notification", {
        error: (error as Error).message,
        issuerId,
        recipientId,
      });
      throw new Error("Database error");
    }
  }

  /**
   * Delete follow notification with aggregation
   */
  async deleteFollowNotification(
    issuerId: string,
    recipientId: string
  ): Promise<void> {
    try {
      const existing = await prisma.notificationObject.findFirst({
        where: { type: "FOLLOW", entityType: "USER", entityId: recipientId },
        include: { actors: true },
      });

      if (!existing) return;

      // Remove the actor
      await prisma.notificationActor.deleteMany({
        where: { notificationObjectId: existing.id, actorId: issuerId },
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
          },
          data: {
            deletedAt: new Date(),
          },
        });
      } else {
        // update aggregation
        const remainingActors = await prisma.notificationActor.findMany({
          where: {
            notificationObjectId: existing.id,
          },
          select: { actorId: true },
        });

        await super.update(existing.id, {
          aggregatedCount: remainingActorsCount,
          summary: {
            json: {
              actors: remainingActors.map((a) => a.actorId),
              count: remainingActorsCount,
              text: this._generateSummaryText(
                remainingActors.map((a) => a.actorId),
                remainingActorsCount,
                "followed"
              ),
            },
          },
        });

        console.log(
          "this is the recipient id of the unfollowing action ------------------------>",
          recipientId
        );
        // Update and broadcast unread count
        await this._updateAndBroadcastUnreadCount(recipientId);

        logger.info(`Follow notification deleted for recipient ${recipientId}`);
      }
    } catch (error: any) {
      logger.error("Error deleting follow notification", {
        error: (error as Error).message,
        issuerId,
        recipientId,
      });
      throw new Error("Database error");
    }
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
      const notification = await prisma.notificationRecipient.findMany({
        where: {
          recipientId,
          read: false,
          deletedAt: null,
        },
      });

      console.log("this is the notification for the user ", notification);
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
