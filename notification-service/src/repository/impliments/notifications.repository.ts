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
  // ✅ FIXED: In-memory cache for user info to avoid repeated fetches
  private userInfoCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly USER_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
   * Create post sent notification (LinkedIn-style)
   * Uses NEW_MESSAGE type since it's similar to sending a message
   */
  // ✅ NEW: Create post notification (for followers when post is created)
  async createPostNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    version: number
  ): Promise<void> {
    await this._createOrUpdateNotification(
      NotificationType.NEW_POST,
      EntityType.POST,
      postId,
      issuerId,
      recipientId,
      version,
      "created a new post"
    );
  }

  async createPostSentNotification(
    senderId: string,
    recipientId: string,
    postId: string,
    message: string | undefined,
    version: number
  ): Promise<void> {
    await this._createOrUpdateNotification(
      NotificationType.NEW_MESSAGE,
      EntityType.POST,
      postId,
      senderId,
      recipientId,
      version,
      message ? "sent you a post with a message" : "sent you a post"
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
   * Fetch user info from auth service
   * ✅ FIXED: Uses internal endpoint for service-to-service calls
   * ✅ FIXED: Added in-memory caching to avoid repeated fetches
   */
  private async fetchUserInfo(userId: string): Promise<any> {
    try {
      // Check cache first
      const cached = this.userInfoCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.USER_INFO_CACHE_TTL) {
        logger.debug(`Using cached user info for ${userId}`);
        return cached.data;
      }

      const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
      const url = `${authServiceUrl}/users/internal/${userId}`;
      
      logger.debug(`Fetching user info from: ${url}`);
      
      // ✅ FIXED: Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        // Use internal endpoint for service-to-service calls
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "x-internal-service": "notification-service",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          logger.warn(`Failed to fetch user info for ${userId}: ${response.status} ${response.statusText} - ${errorText}`);
          return null;
        }

        const result = await response.json();
        logger.debug(`Received user info for ${userId}:`, { 
          hasData: !!result?.data,
          hasName: !!result?.data?.name,
          name: result?.data?.name 
        });
        
        // Handle both { success: true, data: {...} } and direct data formats
        const userData = result?.data || result || null;
        if (userData && !userData.name) {
          logger.warn(`User data for ${userId} missing name field:`, userData);
        }

        // Cache the result
        if (userData) {
          this.userInfoCache.set(userId, {
            data: userData,
            timestamp: Date.now(),
          });
        }

        return userData;
      } catch (error: any) {
        clearTimeout(timeoutId);
        // Handle timeout and other errors
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          logger.warn(`Timeout fetching user info for ${userId}`);
        } else {
          logger.error(`Error fetching user info for ${userId}`, {
            error: error.message,
            stack: error.stack,
          });
        }
        return null;
      }
    } catch (error: any) {
      logger.error(`Error in fetchUserInfo for ${userId}`, {
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  /**
   * Batch fetch user info for multiple actor IDs
   * ✅ FIXED: Better error handling and logging
   */
  private async fetchActorsInfo(actorIds: string[]): Promise<Map<string, any>> {
    const actorMap = new Map<string, any>();
    const uniqueActorIds = [...new Set(actorIds)];

    if (uniqueActorIds.length === 0) {
      return actorMap;
    }

    logger.info(`Fetching user info for ${uniqueActorIds.length} actors`);

    // Fetch all actors in parallel
    const actorPromises = uniqueActorIds.map(async (actorId) => {
      try {
        const userInfo = await this.fetchUserInfo(actorId);
        if (userInfo && userInfo.name) {
          actorMap.set(actorId, {
            id: userInfo.id || actorId,
            name: userInfo.name,
            username: userInfo.username || "",
            profilePicture: userInfo.profilePicture || null,
          });
          logger.debug(`Fetched user info for ${actorId}: ${userInfo.name}`);
        } else {
          // Fallback if user not found
          logger.warn(`User info not found for actor ${actorId}, using fallback`);
          actorMap.set(actorId, {
            id: actorId,
            name: "Unknown User",
            username: "",
            profilePicture: null,
          });
        }
      } catch (error: any) {
        logger.error(`Error fetching user info for actor ${actorId}`, {
          error: error.message,
        });
        // Fallback on error
        actorMap.set(actorId, {
          id: actorId,
          name: "Unknown User",
          username: "",
          profilePicture: null,
        });
      }
    });

    await Promise.all(actorPromises);
    logger.info(`Successfully fetched user info for ${actorMap.size} actors`);
    return actorMap;
  }

  /**
   * Get notifications with pagination and actor user info
   * ✅ FIXED: Includes full actor user info (name, profile picture, username)
   * ✅ FIXED: Reduced cache TTL to 30 seconds for instant updates
   * ✅ FIXED: Sort by notificationObject.createdAt (newest first)
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
      // ✅ REDUCED CACHE: Only cache for 30 seconds instead of 5 minutes
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
                actors: {
                  orderBy: { createdAt: "desc" }, // Most recent actors first
              },
            },
          },
          },
          // ✅ FIXED: Sort by notificationObject.createdAt (newest notifications first)
          orderBy: { 
            notificationObject: {
              createdAt: "desc"
            }
          },
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

      // Collect all unique actor IDs
      const allActorIds: string[] = [];
      notifications.forEach((n) => {
        n.notificationObject.actors.forEach((actor) => {
          if (!allActorIds.includes(actor.actorId)) {
            allActorIds.push(actor.actorId);
          }
        });
      });

      // ✅ FIXED: Fetch actor user info from auth service
      const actorsInfoMap = await this.fetchActorsInfo(allActorIds);

      // Map notifications with actor user info
      const mappedNotifications = notifications.map((n) => {
        const actors = n.notificationObject.actors.map((actor) => {
          const actorInfo = actorsInfoMap.get(actor.actorId);
          return {
            id: actor.actorId,
            name: actorInfo?.name || "Unknown User",
            username: actorInfo?.username || "",
            profilePicture: actorInfo?.profilePicture || null,
          };
        });

        // ✅ FIXED: Update summary with actor names and regenerate summary text
        let summary = n.notificationObject.summary;
        if (summary && typeof summary === "object" && "json" in summary) {
          const summaryData = (summary as any).json || summary;
          
          // Determine action verb from notification type and entity type
          const actionVerb = this._getActionVerbFromNotification(
            n.notificationObject.type,
            n.notificationObject.entityType,
            n.notificationObject.contextId // contextId indicates if it's a reply
          );
          
          // Regenerate summary text with actual actor names
          const summaryText = this._generateSummaryTextWithNames(
            actors,
            n.notificationObject.aggregatedCount || actors.length,
            actionVerb
          );
          
          summary = {
            ...summaryData,
            text: summaryText, // ✅ Use regenerated text with real names
            actors: actors.map((a) => ({
              id: a.id,
              name: a.name,
              username: a.username,
              profilePicture: a.profilePicture,
            })),
          };
        }

        return {
          id: n.id,
          type: n.notificationObject.type,
          entityType: n.notificationObject.entityType,
          entityId: n.notificationObject.entityId,
          contextId: n.notificationObject.contextId,
          summary,
          metadata: n.notificationObject.metadata,
          aggregatedCount: n.notificationObject.aggregatedCount,
          read: n.read,
          readAt: n.readAt,
          createdAt: n.notificationObject.createdAt, // ✅ Use notificationObject.createdAt
          actors, // ✅ Full actor info with name, profile picture, username
        };
      });

      const result = {
        notifications: mappedNotifications,
        total,
        hasMore: offset + limit < total,
      };

      // ✅ REDUCED CACHE: Cache for only 30 seconds for instant updates
      await redisClient.setEx(cacheKey, 30, JSON.stringify(result));

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

      // ✅ FIXED: Make cache invalidation non-blocking to avoid timeout
      // Don't await - let it run in background
      this._invalidateNotificationCache(recipientId).catch((error) => {
        logger.error("Error invalidating cache (non-blocking)", {
          error: error.message,
          recipientId,
        });
      });

      // Update unread count (this is fast, so we can await it)
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

      // ✅ FIXED: Make cache invalidation non-blocking to avoid timeout
      this._invalidateNotificationCache(recipientId).catch((error) => {
        logger.error("Error invalidating cache (non-blocking)", {
          error: error.message,
          recipientId,
        });
      });

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

      // ✅ FIXED: Make cache invalidation non-blocking to avoid timeout
      this._invalidateNotificationCache(recipientId).catch((error) => {
        logger.error("Error invalidating cache (non-blocking)", {
          error: error.message,
          recipientId,
        });
      });

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
   * Invalidate all notification caches for a user
   */
  private async _invalidateNotificationCache(recipientId: string): Promise<void> {
    try {
      // Delete all cache keys for this user's notifications
      const pattern = `notifications:${recipientId}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        // ✅ FIXED: Delete keys one by one or use array spread with proper typing
        // Redis v5 del() accepts multiple keys, but TypeScript needs proper typing
        for (const key of keys) {
          await redisClient.del(key);
        }
        logger.info(`Invalidated ${keys.length} notification cache keys for user ${recipientId}`);
      }
    } catch (error: any) {
      logger.error("Error invalidating notification cache", {
        error: error.message,
        recipientId,
      });
    }
  }

  /**
   * Get notification with full actor info for WebSocket broadcast
   */
  private async _getNotificationWithActorInfo(notificationObjectId: string): Promise<any | null> {
    try {
      const notification = await prisma.notificationObject.findUnique({
        where: { id: notificationObjectId },
        include: {
          actors: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!notification) return null;

      const actorIds = notification.actors.map((a) => a.actorId);
      const actorsInfoMap = await this.fetchActorsInfo(actorIds);

      const actors = notification.actors.map((actor) => {
        const actorInfo = actorsInfoMap.get(actor.actorId);
        return {
          id: actor.actorId,
          name: actorInfo?.name || "Unknown User",
          username: actorInfo?.username || "",
          profilePicture: actorInfo?.profilePicture || null,
        };
      });

      // Update summary with actor info
      let summary = notification.summary;
      if (summary && typeof summary === "object" && "json" in summary) {
        const summaryData = (summary as any).json || summary;
        summary = {
          ...summaryData,
          actors: actors.map((a) => ({
            id: a.id,
            name: a.name,
            username: a.username,
            profilePicture: a.profilePicture,
          })),
        };
      }

      return {
        ...notification,
        summary,
        actors,
      };
    } catch (error: any) {
      logger.error("Error getting notification with actor info", {
        error: error.message,
        notificationObjectId,
      });
      return null;
    }
  }

  /**
   * Update unread count cache
   */
  private async _updateAndBroadcastUnreadCount(
    recipientId: string
  ): Promise<void> {
    try {
      const count = await prisma.notificationRecipient.count({
        where: {
          recipientId,
          read: false,
          deletedAt: null,
        },
      });

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
        // ✅ FIXED: Invalidate cache when new notification is created
        await this._invalidateNotificationCache(recipientId);
        
        // ✅ FIXED: Fetch full notification with actor info before broadcasting
        const fullNotification = await this._getNotificationWithActorInfo(notificationObject.id);
        if (fullNotification) {
          this.wsService?.broadcastNotification(recipientId, fullNotification);
        } else {
        this.wsService?.broadcastNotification(recipientId, notificationObject);
        }
        
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
   * Generate summary text for aggregated notifications (with actor IDs)
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

  /**
   * Generate summary text with actual actor names (for display)
   * ✅ NEW: Uses actor objects with names instead of IDs
   */
  private _generateSummaryTextWithNames(
    actors: Array<{ id: string; name: string; username?: string }>,
    count: number,
    action: string
  ): string {
    if (actors.length === 0) {
      return `Someone ${action} you`;
    }

    const firstActor = actors[0];
    const firstName = firstActor.name && firstActor.name !== "Unknown User" 
      ? firstActor.name 
      : firstActor.username || "Someone";

    if (count === 1) {
      return `${firstName} ${action} you`;
    } else if (count === 2 && actors.length >= 2) {
      const secondActor = actors[1];
      const secondName = secondActor.name && secondActor.name !== "Unknown User"
        ? secondActor.name
        : secondActor.username || "Someone";
      return `${firstName} and ${secondName} ${action} you`;
    } else {
      return `${firstName} and ${count - 1} others ${action} you`;
    }
  }

  /**
   * Get action verb from notification type and entity type
   * ✅ FIXED: Returns proper action phrases like "liked your post", "commented on your post", etc.
   */
  private _getActionVerbFromNotification(
    type: NotificationType,
    entityType: EntityType,
    contextId?: string | null
  ): string {
    switch (type) {
      case NotificationType.LIKE:
        if (entityType === EntityType.POST) {
          return "liked your post";
        } else if (entityType === EntityType.COMMENT) {
          return "liked your comment";
        }
        return "liked";
        
      case NotificationType.COMMENT:
        // If contextId exists, it's a reply to a comment
        if (contextId) {
          return "replied to your comment";
        } else if (entityType === EntityType.POST) {
          return "commented on your post";
        } else {
          return "commented on";
        }
        
      case NotificationType.MENTION:
        return "mentioned you in a comment";
        
      case NotificationType.FOLLOW:
        return "started following you";
        
      case NotificationType.NEW_MESSAGE:
        return "sent you a post";
        
      case NotificationType.ROOM_REMINDER:
        return "reminder";
        
      default:
        return "interacted with your content";
    }
  }
}
