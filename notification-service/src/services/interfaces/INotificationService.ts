export interface INotificationService {
    createFollowNotification(issuerId: string, recipientId: string, version: number): Promise<void>;
    deleteFollowNotification(issuerId: string, recipientId: string): Promise<void>;
    createLikeNotification(issuerId: string, recipientId: string, entityId: string, entityType: "POST" | "COMMENT", version: number, contextId?: string, metadata?: any): Promise<void>;
    deleteLikeNotification(issuerId: string, recipientId: string, entityId: string, entityType: "POST" | "COMMENT", version: number): Promise<void>;
    createCommentNotification(issuerId: string, recipientId: string, postId: string, commentId: string, notificationType: "POST" | "COMMENT", version: number): Promise<void>;
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