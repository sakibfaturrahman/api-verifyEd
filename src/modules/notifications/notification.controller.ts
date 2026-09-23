import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service";
import { successResponse } from "../../core/utils/response";
import { UnauthorizedError } from "../../core/errors/UnauthorizedError";

export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedError("Authentication required");
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 10;
      const unreadOnly = req.query.unread === "true";
      const role = req.user.role === "admin" ? "admin" : "user";

      const result = await this.notificationService.getNotifications({
        userId: req.user.id,
        role,
        page,
        limit,
        unreadOnly,
      });

      successResponse({
        res,
        message: "Notifications retrieved successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedError("Authentication required");
      }

      const { id } = req.params;
      const isAdmin = req.user.role === "admin";
      await this.notificationService.markAsRead(
        String(id),
        req.user.id,
        isAdmin,
      );

      successResponse({
        res,
        message: "Notification marked as read",
      });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedError("Authentication required");
      }

      const isAdmin = req.user.role === "admin";
      await this.notificationService.markAllAsRead(req.user.id, isAdmin);

      successResponse({
        res,
        message: "All notifications marked as read",
      });
    } catch (error) {
      next(error);
    }
  };
}
