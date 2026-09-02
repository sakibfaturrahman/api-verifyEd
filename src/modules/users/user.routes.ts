import { Router } from 'express';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { validate } from '../../core/middleware/validation.middleware';
import { authenticate } from '../../core/middleware/auth.middleware';
import { updateProfileSchema, changePasswordSchema } from './user.validation';

const router = Router();

const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

// All profile routes require authentication
router.use(authenticate);

router.get('/', userController.getProfile);
router.put('/', validate('body', updateProfileSchema), userController.updateProfile);
router.post('/change-password', validate('body', changePasswordSchema), userController.changePassword);

export { userRepository, userService };
export default router;
