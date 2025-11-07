// interface INotificationRepository {
//     // getCurrentVersion(entityId: string): Promise<number>;
//     createFollowNotification(issuerId: string, recipientId: string, version: number): Promise<void>;
//     deleteFollowNotification(issuerId: string, recipientId: string): Promise<void>; 
// }

interface INotificationRepository {
    createFollowNotification(issuerId: string, recipientId: string, version: number): Promise<void>;
    deleteFollowNotification(issuerId: string, recipientId: string): Promise<void>;
    // createLikeNotification(issuerId: string, recipientId: string, postId: string, version: number): Promise<void>;
    // deleteLikeNotification(issuerId: string, recipientId: string, postId: string): Promise<void>;
    // createCommentNotification(issuerId: string, recipientId: string, postId: string, commentId: string, content: string): Promise<void>;
    getNotifications(recipientId: string, limit: number, offset: number): Promise<{
      notifications: any[];
      total: number;
      hasMore: boolean;
    }>;
    markAsRead(notificationId: string, recipientId: string): Promise<void>;
    deleteNotification(notificationId: string, recipientId: string): Promise<void>;
    getUnreadCount(recipientId: string): Promise<number>;
    markAllAsRead(recipientId: string): Promise<void>;
  }