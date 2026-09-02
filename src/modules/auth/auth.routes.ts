import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { validate } from '../../core/middleware/validation.middleware';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authRateLimit } from '../../core/middleware/rateLimit.middleware';
import { registerSchema, loginSchema, refreshSchema } from './auth.validation';

const router = Router();

// Wire up dependencies
const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);
const authController = new AuthController(authService);

// Apply strict rate limiting to all auth routes
router.use(authRateLimit);

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication — register, login, logout, session management
 */
router.post('/register', validate('body', registerSchema), authController.register);
router.post('/login', validate('body', loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', validate('body', refreshSchema), authController.refresh);
router.get('/me', authenticate, authController.me);

export default router;
