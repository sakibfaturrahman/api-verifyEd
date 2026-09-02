import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { successResponse } from '../../core/utils/response';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * @openapi
   * /api/v1/auth/register:
   *   post:
   *     tags: [Auth]
   *     summary: Register a new user account
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email, password]
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 2
   *                 example: Jane Smith
   *               email:
   *                 type: string
   *                 format: email
   *                 example: jane@example.com
   *               password:
   *                 type: string
   *                 minLength: 8
   *                 description: Must contain uppercase, lowercase, and number
   *                 example: SecurePass123
   *     responses:
   *       201:
   *         description: Registration successful
   *       409:
   *         description: Email already registered
   *       422:
   *         $ref: '#/components/schemas/ValidationErrorResponse'
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      successResponse({ res, message: result.message, statusCode: 201 });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/login:
   *   post:
   *     tags: [Auth]
   *     summary: Login and obtain access/refresh tokens
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 message: { type: string }
   *                 data:
   *                   type: object
   *                   properties:
   *                     accessToken: { type: string }
   *                     refreshToken: { type: string }
   *                     expiresAt: { type: number }
   *                     profile: { $ref: '#/components/schemas/Profile' }
   *       401:
   *         description: Invalid credentials
   *       403:
   *         description: Account is inactive
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session, profile } = await this.authService.login(req.body);
      successResponse({
        res,
        message: 'Login successful',
        data: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          profile: {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            status: profile.status,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/logout:
   *   post:
   *     tags: [Auth]
   *     summary: Logout and revoke all sessions
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logged out successfully
   *       401:
   *         description: Not authenticated
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.logout(req.user!.id);
      successResponse({ res, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/refresh:
   *   post:
   *     tags: [Auth]
   *     summary: Refresh access token using a refresh token
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refreshToken]
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tokens refreshed
   *       401:
   *         description: Invalid refresh token
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await this.authService.refresh(req.body);
      successResponse({
        res,
        message: 'Token refreshed successfully',
        data: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/me:
   *   get:
   *     tags: [Auth]
   *     summary: Get current authenticated user's profile
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Profile'
   *       401:
   *         description: Not authenticated
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await this.authService.getMe(req.user!.id);
      successResponse({ res, message: 'Profile retrieved successfully', data: profile });
    } catch (err) {
      next(err);
    }
  };
}
