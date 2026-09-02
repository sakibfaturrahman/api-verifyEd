import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { successResponse } from '../../core/utils/response';

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * @openapi
   * /api/v1/dashboard/user:
   *   get:
   *     tags: [Dashboard]
   *     summary: Get user dashboard statistics
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dashboard stats and chart data
   */
  getUserDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.dashboardService.getUserDashboard(req.user!.id);
      successResponse({ res, message: 'Dashboard data retrieved successfully', data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/admin/dashboard:
   *   get:
   *     tags: [Admin]
   *     summary: Get admin platform-wide dashboard statistics
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Platform-wide stats
   */
  getAdminDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.dashboardService.getAdminDashboard();
      successResponse({ res, message: 'Admin dashboard data retrieved successfully', data });
    } catch (err) {
      next(err);
    }
  };
}
