import logger from "../../utils/logger.util";
import { INotificationService } from "../interfaces/INotificationService";

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
    } catch (error: any) {
      logger.error("Error in notification service - createFollowNotification", {
        error: error.message,
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
    } catch (error: any) {
      logger.error("Error in notification service - deleteFollowNotification", {
        error: error.message,
        issuerId,
        recipientId,
      });
      throw error;
    }
  }

  async createLikeNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    version: number
  ): Promise<void> {
    try {
      //   await this._notificationRepository.createLikeNotification(issuerId, recipientId, postId, version);
      logger.info(
        `Like notification created for user ${recipientId} by ${issuerId} on post ${postId}`
      );
    } catch (error: any) {
      logger.error("Error in notification service - createLikeNotification", {
        error: error.message,
        issuerId,
        recipientId,
        postId,
      });
      throw error;
    }
  }

  async deleteLikeNotification(
    issuerId: string,
    recipientId: string,
    postId: string
  ): Promise<void> {
    try {
      //   await this._notificationRepository.deleteLikeNotification(issuerId, recipientId, postId);
      logger.info(
        `Like notification deleted for user ${recipientId} by ${issuerId} on post ${postId}`
      );
    } catch (error: any) {
      logger.error("Error in notification service - deleteLikeNotification", {
        error: error.message,
        issuerId,
        recipientId,
        postId,
      });
      throw error;
    }
  }

  async createCommentNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    commentId: string,
    content: string
  ): Promise<void> {
    try {
      //   await this._notificationRepository.createCommentNotification(issuerId, recipientId, postId, commentId, content);
      logger.info(
        `Comment notification created for user ${recipientId} by ${issuerId} on post ${postId}`
      );
    } catch (error: any) {
      logger.error(
        "Error in notification service - createCommentNotification",
        {
          error: error.message,
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
    notifications: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      return await this._notificationRepository.getNotifications(
        recipientId,
        limit,
        offset
      );
    } catch (error: any) {
      logger.error("Error in notification service - getNotifications", {
        error: error.message,
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
    } catch (error: any) {
      logger.error("Error in notification service - markAsRead", {
        error: error.message,
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
    } catch (error: any) {
      logger.error("Error in notification service - deleteNotification", {
        error: error.message,
        notificationId,
        recipientId,
      });
      throw error;
    }
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    try {
      return await this._notificationRepository.getUnreadCount(recipientId);
    } catch (error: any) {
      logger.error("Error in notification service - getUnreadCount", {
        error: error.message,
        recipientId,
      });
      throw error;
    }
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    try {
      await this._notificationRepository.markAllAsRead(recipientId);
      logger.info(`All notifications marked as read for user ${recipientId}`);
    } catch (error: any) {
      logger.error("Error in notification service - markAllAsRead", {
        error: error.message,
        recipientId,
      });
      throw error;
    }
  }
}
