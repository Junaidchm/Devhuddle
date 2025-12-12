import { Router } from "express";
import { NotificationController } from "../controllers/impliments/notification.controller";
import { validateDto } from "../middlewares/validation.middleware";
import { NotificationOwnerDto } from "../dtos/notification.dto";
import { NotificationService } from "../services/impliments/notification.service";
import { NotificationsRepository } from "../repository/impliments/notifications.repository";

const router = Router();
const notificationRepository = new NotificationsRepository();
const notificationService = new NotificationService(notificationRepository);
const notificationController = new NotificationController(notificationService);

router
  .get(
    "/:recipientId",
    notificationController.getNotifications.bind(notificationController)
  )
  .patch(
    "/:id/read",
    validateDto(NotificationOwnerDto),
    notificationController.markAsRead.bind(notificationController)
  )
  .delete(
    "/:id",
    validateDto(NotificationOwnerDto),
    notificationController.deleteNotification.bind(notificationController)
  )
  .get(
    "/:recipientId/unread-count",
    notificationController.getUnreadCount.bind(notificationController)
  )
  .post(
    "/:userId/mark-all-read",
    notificationController.markAllAsRead.bind(notificationController)
  );

export default router;
