import { Router } from "express";
import authRouter from "../modules/auth/auth.routes";
import userRouter from "../modules/users/user.routes";
import eventRouter from "../modules/events/event.routes";
import certificateRouter from "../modules/certificates/certificate.routes";
import verificationRouter from "../modules/verification/verification.routes";
import dashboardRouter, {
  adminRouter,
} from "../modules/dashboard/dashboard.routes";
import notificationRouter from "../modules/notifications/notification.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/profile", userRouter);
router.use("/events", eventRouter);
router.use("/certificates", certificateRouter);
router.use("/verify", verificationRouter);
router.use("/dashboard", dashboardRouter);
router.use("/admin", adminRouter);
router.use("/notifications", notificationRouter);
export default router;
