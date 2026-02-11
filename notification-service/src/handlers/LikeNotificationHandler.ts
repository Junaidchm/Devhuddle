import { INotificationRepository } from "../repository/interface/INotificationRepository";
import { INotificationHandler } from "./INotificationHandler";
import logger from "../utils/logger.util";

export class LikeNotificationHandler implements INotificationHandler {
  type = "LIKE";

  constructor(private _notificationRepository: INotificationRepository) {}

  async handle(payload: any): Promise<void> {
    const { issuerId, recipientId, postId, version } = payload;
    try {
      //   await this._notificationRepository.createLikeNotification(issuerId, recipientId, postId, version);
      logger.info(
        `Like notification created for user ${recipientId} by ${issuerId} on post ${postId}`
      );
    } catch (error: unknown) {
      logger.error("Error in LikeNotificationHandler", {
        error: (error as Error).message,
        issuerId,
        recipientId,
        postId,
      });
      throw error;
    }
  }
}
