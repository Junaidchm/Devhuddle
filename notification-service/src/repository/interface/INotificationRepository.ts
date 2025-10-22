interface INotificationRepository {
    // getCurrentVersion(entityId: string): Promise<number>;
    createFollowNotification(issuerId: string, recipientId: string, version: number): Promise<void>;
    deleteFollowNotification(issuerId: string, recipientId: string): Promise<void>; 
}