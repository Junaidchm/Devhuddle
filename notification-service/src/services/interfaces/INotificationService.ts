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
    restoreNotification(notificationId: string, recipientId: string): Promise<void>;
    createChatNotification(senderId: string, recipientId: string, conversationId: string, messageId: string, content: string, version: number, messageType?: string, replyToId?: string): Promise<void>;
    createReactionNotification(senderId: string, recipientId: string, conversationId: string, messageId: string, emoji: string, version: number): Promise<void>;
    deleteReactionNotification(senderId: string, recipientId: string, messageId: string, emoji: string, version: number): Promise<void>;
    createHubJoinRequestNotification(requesterId: string, recipientId: string, hubId: string, requestId: string, version: number, hubName?: string): Promise<void>;
    createHubJoinApprovedNotification(adminId: string, recipientId: string, hubId: string, requestId: string, version: number, hubName?: string): Promise<void>;
    createHubJoinRejectedNotification(adminId: string, recipientId: string, hubId: string, requestId: string, version: number, hubName?: string): Promise<void>;
    createGroupAddedNotification(issuerId: string, recipientId: string, conversationId: string, version: number): Promise<void>;
}