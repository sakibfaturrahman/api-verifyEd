import { Router } from "express";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { UserRepository } from "./user.repository";
import { authenticate } from "../../core/middleware/auth.middleware";

const router = Router();
const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

// Menangani GET profile
router.get("/", authenticate, userController.getProfile);
router.get("/profile", authenticate, userController.getProfile);

// Menangani Update Profile (PUT & PATCH)
router.put("/", authenticate, userController.updateProfile);
router.put("/profile", authenticate, userController.updateProfile);
router.patch("/", authenticate, userController.updateProfile);
router.patch("/profile", authenticate, userController.updateProfile);

// Menangani Change Password
router.post("/change-password", authenticate, userController.changePassword);
router.post(
  "/profile/change-password",
  authenticate,
  userController.changePassword,
);

export default router;
