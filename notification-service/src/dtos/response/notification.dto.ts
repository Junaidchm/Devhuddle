/**
 * Response DTO for a notification
 */
export interface NotificationResponseDto {
  id: string;
  recipientId: string;
  type: string;
  actorId?: string;
  postId?: string;
  commentId?: string;
  message?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}
