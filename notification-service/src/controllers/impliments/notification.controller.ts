import { Request, Response } from "express";
import logger from "../../utils/logger.util";
import { INotificationService } from "../../services/interfaces/INotificationService";

export class NotificationController {
  constructor(private _notificationService: INotificationService) {}

  /**
   * Get notifications with pagination
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { recipientId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!recipientId) {
        res.status(400).json({ error: "Recipient ID is required" });
        return;
      }

      const result = await this._notificationService.getNotifications(
        recipientId,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error fetching notifications", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { recipientId } = req.body;

      if (!id) {
        res.status(400).json({ error: "Notification ID is required" });
        return;
      }
      
      // recipientId validation handled by DTO

      await this._notificationService.markAsRead(id, recipientId);

      res.status(200).json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error: any) {
      logger.error("Error marking notification as read", {
        error: error.message,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { recipientId } = req.body;

      if (!id) {
         res.status(400).json({ error: "Notification ID is required" });
         return;
      }

      // recipientId validation handled by DTO

      await this._notificationService.deleteNotification(id, recipientId);

      res.status(200).json({
        success: true,
        message: "Notification deleted",
      });
    } catch (error: any) {
      logger.error("Error deleting notification", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {

      console.log('the request is comming here for unread notification ----------------------------->')
      const { recipientId } = req.params;

      if (!recipientId) {
        res.status(400).json({ error: "Recipient ID is required" });
        return;
      }

      const count = await this._notificationService.getUnreadCount(recipientId);

      res.status(200).json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error: any) {
      logger.error("Error getting unread count", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      await this._notificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error: any) {
      logger.error("Error marking all notifications as read", {
        error: error.message,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
