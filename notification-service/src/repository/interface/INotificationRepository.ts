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
    entityType: "POST" | "COMMENT" | "PROJECT",
    version: number,
    contextId?: string,
    metadata?: any
  ): Promise<void>;

  deleteLikeNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT" | "PROJECT",
    version: number
  ): Promise<void>;

  getLikeNotification(
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT" | "PROJECT"
  ): Promise<NotificationObject | null>;

  // Comment notifications (aggregated)
  createCommentNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    commentId: string,
    notificationType: "POST" | "COMMENT" | "PROJECT",
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
    entityType: "POST" | "COMMENT" | "PROJECT",
    version: number
  ): Promise<void>;

  // Post Sent notifications (LinkedIn-style)
  createPostSentNotification(
    senderId: string,
    recipientId: string,
    postId: string,
    message: string | undefined,
    version: number
  ): Promise<void>;

  // ✅ NEW: Post creation notification (for followers)
  createPostNotification(
    issuerId: string,
    recipientId: string,
    postId: string,
    version: number
  ): Promise<void>;

  // Share notifications
  createShareNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    version: number,
    entityType?: "POST" | "PROJECT"
  ): Promise<void>;

  // Report notifications
  createReportNotification(
    issuerId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT" | "PROJECT",
    reason: string,
    version: number,
    metadata?: any
  ): Promise<void>;

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
  restoreNotification(
    notificationId: string,
    recipientId: string
  ): Promise<void>;

  // Chat notifications
  createChatNotification(
    senderId: string,
    recipientId: string,
    conversationId: string,
    messageId: string,
    content: string,
    version: number
  ): Promise<void>;

  // Cleanup
  deleteUserNotifications(userId: string): Promise<void>;

  // Hub Join Requests
  createHubJoinRequestNotification(
    requesterId: string,
    recipientId: string,
    hubId: string,
    requestId: string,
    version: number
  ): Promise<void>;

  createHubJoinApprovedNotification(
    adminId: string,
    recipientId: string,
    hubId: string,
    requestId: string,
    version: number
  ): Promise<void>;

  createHubJoinRejectedNotification(
    adminId: string,
    recipientId: string,
    hubId: string,
    requestId: string,
    version: number
  ): Promise<void>;

  createEnforcedNotification(
    adminId: string,
    recipientId: string,
    entityId: string,
    entityType: "POST" | "COMMENT" | "PROJECT",
    action: "HIDE" | "UNHIDE",
    reason: string,
    version: number
  ): Promise<void>;
}
