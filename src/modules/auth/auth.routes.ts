import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repository";
import { notificationService } from "../notifications/notification.routes";
import { authenticate } from "../../core/middleware/auth.middleware";

const router = Router();

const authRepository = new AuthRepository();
export const authService = new AuthService(authRepository, notificationService);
const authController = new AuthController(authService);

// rute autentikasi publik
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);

// rute autentikasi terproteksi
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);

export default router;
