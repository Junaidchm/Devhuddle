import { INotificationRepository } from "../repository/interface/INotificationRepository";
import { INotificationHandler } from "./INotificationHandler";
import logger from "../utils/logger.util";

export class CommentNotificationHandler implements INotificationHandler {
  type = "COMMENT";

  constructor(private _notificationRepository: INotificationRepository) {}

  async handle(payload: any): Promise<void> {
    const { issuerId, recipientId, postId, commentId, content } = payload;
    try {
      //   await this._notificationRepository.createCommentNotification(issuerId, recipientId, postId, commentId, content);
      logger.info(
        `Comment notification created for user ${recipientId} by ${issuerId} on post ${postId}`
      );
    } catch (error: unknown) {
      logger.error("Error in CommentNotificationHandler", {
        error: (error as Error).message,
        issuerId,
        recipientId,
        postId,
        commentId,
      });
      throw error;
    }
  }
}
