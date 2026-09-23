import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";

const notificationRepository = new NotificationRepository();
export const notificationService = new NotificationService(
  notificationRepository,
);
const notificationController = new NotificationController(notificationService);

const router = Router();

// Lindungi seluruh endpoint agar wajib login
router.use(authenticate);

// Rute notifikasi untuk admin maupun user
router.get("/", notificationController.getNotifications);
router.patch("/:id/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);

export default router;
