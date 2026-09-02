import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { successResponse } from '../../core/utils/response';

export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * @openapi
   * /api/v1/profile:
   *   get:
   *     tags: [Profile]
   *     summary: Get the authenticated user's profile
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Profile retrieved
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Profile'
   */
  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await this.userService.getProfile(req.user!.id);
      successResponse({ res, message: 'Profile retrieved successfully', data: profile });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/profile:
   *   put:
   *     tags: [Profile]
   *     summary: Update the authenticated user's profile
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name: { type: string }
   *               phone: { type: string, nullable: true }
   *               address: { type: string, nullable: true }
   *               description: { type: string, nullable: true }
   *               avatar_url: { type: string, nullable: true }
   *     responses:
   *       200:
   *         description: Profile updated
   */
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await this.userService.updateProfile(req.user!.id, req.body);
      successResponse({ res, message: 'Profile updated successfully', data: profile });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/profile/change-password:
   *   post:
   *     tags: [Profile]
   *     summary: Change password (requires current password verification)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [currentPassword, newPassword]
   *             properties:
   *               currentPassword: { type: string }
   *               newPassword: { type: string, minLength: 8 }
   *     responses:
   *       200:
   *         description: Password changed
   *       401:
   *         description: Current password incorrect
   */
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.userService.changePassword(req.user!.id, req.body);
      successResponse({ res, message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  };
}
