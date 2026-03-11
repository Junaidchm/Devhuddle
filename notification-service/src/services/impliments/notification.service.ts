import { INotificationRepository } from "../../repository/interface/INotificationRepository";
import logger from "../../utils/logger.util";
import { INotificationService } from "../interfaces/INotificationService";
import { NotificationWithDetails } from "../../types/common.types";

export class NotificationService implements INotificationService {
  constructor(private _notificationRepository: INotificationRepository) {}

  async createFollowNotification(
    issuerId: string,
    recipientId: string,
    version: number
  ): Promise<void> {
    try {
      await this._notificationRepository.createFollowNotification(
        issuerId,
        recipientId,
        version
      );
      logger.info(
        `Follow notification created for user ${recipientId} by ${issuerId}`
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - createFollowNotification", {
        error: (error as Error).message,
        issuerId,
        recipientId,
      });
      throw error;
    }
  }

  async deleteFollowNotification(
    issuerId: string,
    recipientId: string
  ): Promise<void> {
    try {
      await this._notificationRepository.deleteFollowNotification(
        issuerId,
        recipientId
      );
      logger.info(
        `Follow notification deleted for user ${recipientId} by ${issuerId}`
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - deleteFollowNotification", {
        error: (error as Error).message,
        issuerId,
        recipientId,
      });
      throw error;
    }
  }

  async createLikeNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT",
    version: number,
    contextId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this._notificationRepository.createLikeNotification(
        issuerId,
        recipientId,
        entityId,
        entityType,
        version,
        contextId,
        metadata
      );
      logger.info(
        `Like notification created for user ${recipientId} by ${issuerId} on ${entityType} ${entityId}`
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - createLikeNotification", {
        error: (error as Error).message,
        issuerId,
        recipientId,
        entityId,
      });
      throw error;
    }
  }

  async deleteLikeNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT",
    version: number
  ): Promise<void> {
    try {
      await this._notificationRepository.deleteLikeNotification(
        issuerId,
        recipientId,
        entityId,
        entityType,
        version
      );
      logger.info(
        `Like notification deleted for user ${recipientId} by ${issuerId} on ${entityType} ${entityId}`
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - deleteLikeNotification", {
        error: (error as Error).message,
        issuerId,
        recipientId,
        entityId,
      });
      throw error;
    }
  }

  async createCommentNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    commentId: string,
    notificationType: "POST" | "COMMENT",
    version: number
  ): Promise<void> {
    try {
      await this._notificationRepository.createCommentNotification(
        issuerId,
        recipientId,
        postId,
        commentId,
        notificationType,
        version
      );
      logger.info(
        `Comment notification created for user ${recipientId} by ${issuerId} on post ${postId}`
      );
    } catch (error: unknown) {
      logger.error(
        "Error in notification service - createCommentNotification",
        {
          error: (error as Error).message,
          issuerId,
          recipientId,
          postId,
          commentId,
        }
      );
      throw error;
    }
  }

  async getNotifications(
    recipientId: string,
    limit: number,
    offset: number
  ): Promise<{
    notifications: NotificationWithDetails[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      return await this._notificationRepository.getNotifications(
        recipientId,
        limit,
        offset
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - getNotifications", {
        error: (error as Error).message,
        recipientId,
      });
      throw error;
    }
  }

  async markAsRead(notificationId: string, recipientId: string): Promise<void> {
    try {
      await this._notificationRepository.markAsRead(
        notificationId,
        recipientId
      );
      logger.info(
        `Notification ${notificationId} marked as read for user ${recipientId}`
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - markAsRead", {
        error: (error as Error).message,
        notificationId,
        recipientId,
      });
      throw error;
    }
  }

  async deleteNotification(
    notificationId: string,
    recipientId: string
  ): Promise<void> {
    try {
      await this._notificationRepository.deleteNotification(
        notificationId,
        recipientId
      );
      logger.info(
        `Notification ${notificationId} deleted for user ${recipientId}`
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - deleteNotification", {
        error: (error as Error).message,
        notificationId,
        recipientId,
      });
      throw error;
    }
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    try {
      return await this._notificationRepository.getUnreadCount(recipientId);
    } catch (error: unknown) {
      logger.error("Error in notification service - getUnreadCount", {
        error: (error as Error).message,
        recipientId,
      });
      throw error;
    }
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    try {
      await this._notificationRepository.markAllAsRead(recipientId);
      logger.info(`All notifications marked as read for user ${recipientId}`);
    } catch (error: unknown) {
      logger.error("Error in notification service - markAllAsRead", {
        error: (error as Error).message,
        recipientId,
      });
      throw error;
    }
  }

  async restoreNotification(notificationId: string, recipientId: string): Promise<void> {
    try {
      await this._notificationRepository.restoreNotification(notificationId, recipientId);
      logger.info(`Notification ${notificationId} restored for user ${recipientId}`);
    } catch (error: unknown) {
      logger.error("Error in notification service - restoreNotification", {
        error: (error as Error).message,
        notificationId,
        recipientId,
      });
      throw error;
    }
  }

  async createChatNotification(
    senderId: string,
    recipientId: string,
    conversationId: string,
    messageId: string,
    content: string,
    version: number
  ): Promise<void> {
    try {
      await this._notificationRepository.createChatNotification(
        senderId,
        recipientId,
        conversationId,
        messageId,
        content,
        version
      );
      logger.info(
        `Chat notification created for user ${recipientId} by ${senderId} in conversation ${conversationId}`
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - createChatNotification", {
        error: (error as Error).message,
        senderId,
        recipientId,
        conversationId,
      });
      throw error;
    }
  }

  async createHubJoinRequestNotification(
    requesterId: string,
    recipientId: string,
    hubId: string,
    requestId: string,
    version: number
  ): Promise<void> {
    try {
      await this._notificationRepository.createHubJoinRequestNotification(
        requesterId,
        recipientId,
        hubId,
        requestId,
        version
      );
    } catch (error: any) {
      logger.error("Error creating HubJoinRequest notification", { error: error.message });
      throw error;
    }
  }

  async createHubJoinApprovedNotification(
    adminId: string,
    recipientId: string,
    hubId: string,
    requestId: string,
    version: number
  ): Promise<void> {
    try {
      await this._notificationRepository.createHubJoinApprovedNotification(
        adminId,
        recipientId,
        hubId,
        requestId,
        version
      );
    } catch (error: any) {
      logger.error("Error creating HubJoinApproved notification", { error: error.message });
      throw error;
    }
  }

  async createHubJoinRejectedNotification(
    adminId: string,
    recipientId: string,
    hubId: string,
    requestId: string,
    version: number
  ): Promise<void> {
    try {
      await this._notificationRepository.createHubJoinRejectedNotification(
        adminId,
        recipientId,
        hubId,
        requestId,
        version
      );
    } catch (error: any) {
      logger.error("Error creating HubJoinRejected notification", { error: error.message });
      throw error;
    }
  }

  async createGroupAddedNotification(
    issuerId: string,
    recipientId: string,
    conversationId: string,
    version: number
  ): Promise<void> {
    try {
      await this._notificationRepository.createGroupAddedNotification(
        issuerId,
        recipientId,
        conversationId,
        version
      );
      logger.info(
        `Group added notification created for user ${recipientId} by ${issuerId} in conversation ${conversationId}`
      );
    } catch (error: unknown) {
      logger.error("Error in notification service - createGroupAddedNotification", {
        error: (error as Error).message,
        issuerId,
        recipientId,
        conversationId,
      });
      throw error;
    }
  }
}
