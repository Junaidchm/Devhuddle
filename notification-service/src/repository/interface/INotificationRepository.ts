// interface INotificationRepository {
//     // getCurrentVersion(entityId: string): Promise<number>;
//     createFollowNotification(issuerId: string, recipientId: string, version: number): Promise<void>;
//     deleteFollowNotification(issuerId: string, recipientId: string): Promise<void>;
// }

import { NotificationObject } from "@prisma/client";

export interface INotificationRepository {
  createFollowNotification(
    issuerId: string,
    recipientId: string,
    version: number
  ): Promise<void>;
  deleteFollowNotification(
    issuerId: string,
    recipientId: string
  ): Promise<void>;

  // Like notifications (aggregated)
  createLikeNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT",
    version: number 
  ): Promise<void>;

  deleteLikeNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT",
    version: number
  ): Promise<void>;

  getLikeNotification(
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT"
  ): Promise<NotificationObject | null>;

  // Comment notifications (aggregated)
  createCommentNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    commentId: string,
    notificationType: "POST" | "COMMENT",
    version: number
  ): Promise<void>;

  deleteCommentNotification(
    commentId: string,
    version: number
  ): Promise<void>;

  // Mention notifications
  createMentionNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    commentId: string,
    entityType: "POST" | "COMMENT",
    version: number
  ): Promise<void>;

  // // Report notifications (typically not aggregated, but keeping for consistency)
  // createReportNotification(issuerId: string, recipientId: string, postId: string): Promise<void>;

  getNotifications(
    recipientId: string,
    limit: number,
    offset: number
  ): Promise<{
    notifications: any[];
    total: number;
    hasMore: boolean;
  }>;
  markAsRead(notificationId: string, recipientId: string): Promise<void>;
  deleteNotification(
    notificationId: string,
    recipientId: string
  ): Promise<void>;
  getUnreadCount(recipientId: string): Promise<number>;
  markAllAsRead(recipientId: string): Promise<void>;
}
