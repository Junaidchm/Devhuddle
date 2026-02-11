import { INotificationRepository } from "../repository/interface/INotificationRepository";
import { INotificationHandler } from "./INotificationHandler";
import logger from "../utils/logger.util";

export class FollowNotificationHandler implements INotificationHandler {
  type = "FOLLOW";

  constructor(private _notificationRepository: INotificationRepository) {}

  async handle(payload: any): Promise<void> {
    const { issuerId, recipientId, version } = payload;
    try {
      await this._notificationRepository.createFollowNotification(
        issuerId,
        recipientId,
        version
      );
      logger.info(
        `Follow notification created for user ${recipientId} by ${issuerId}`
      );
    } catch (error: unknown) {
      logger.error("Error in FollowNotificationHandler", {
        error: (error as Error).message,
        issuerId,
        recipientId,
      });
      throw error;
    }
  }
}
