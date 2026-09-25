import { Router } from "express";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { UserRepository } from "./user.repository";
import { authenticate } from "../../core/middleware/auth.middleware";

const router = Router();
const userRepository = new UserRepository();
export const userService = new UserService(userRepository);
const userController = new UserController(userService);

// Dukung baik /profile maupun /users/profile, serta method PUT dan PATCH
router.get("/profile", authenticate, userController.getProfile);
router.put("/profile", authenticate, userController.updateProfile);
router.patch("/profile", authenticate, userController.updateProfile);
router.post("/profile/change-password", authenticate, userController.changePassword);

export default router;