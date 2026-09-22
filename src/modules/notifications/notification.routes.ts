import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { authorize } from "../../core/middleware/role.middleware";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";

const notificationRepository = new NotificationRepository();
export const notificationService = new NotificationService(
  notificationRepository,
);
const notificationController = new NotificationController(notificationService);

const router = Router();

// seluruh rute notifikasi di bawah dilindungi khusus admin
router.use(authenticate, authorize("admin"));

// rute get notifikasi, mark read, dan mark all read
router.get("/", notificationController.getNotifications);
router.patch("/:id/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);

export default router;
