import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { AdminController } from "./admin.controller";
import { DashboardService } from "./dashboard.service";
import { DashboardRepository } from "./dashboard.repository";
import { authenticate } from "../../core/middleware/auth.middleware";
import { authorize } from "../../core/middleware/role.middleware";
import { VerificationRepository } from "../verification/verification.repository";
import { userService } from "../users/user.routes";
import { eventService } from "../events/event.routes";
import { certService } from "../certificates/certificate.routes";
import { verificationService } from "../verification/verification.routes";
import { VerificationController } from "../verification/verification.controller";

const router = Router();

const dashboardRepository = new DashboardRepository();
const verificationRepository = new VerificationRepository();
const dashboardService = new DashboardService(
  dashboardRepository,
  verificationRepository,
);
const dashboardController = new DashboardController(dashboardService);
const adminController = new AdminController(
  userService,
  eventService,
  certService,
);
const verificationController = new VerificationController(verificationService);

// rute dasbor pengguna
router.get(
  "/user",
  authenticate,
  authorize("admin", "user"),
  dashboardController.getUserDashboard,
);

export default router;

// router admin dipasang pada path /api/v1/admin
export const adminRouter = Router();

adminRouter.use(authenticate, authorize("admin"));

adminRouter.get("/dashboard", dashboardController.getAdminDashboard);

// manajemen pengguna oleh admin
adminRouter.get("/users", adminController.listUsers);
adminRouter.get("/users/:id", adminController.getUserById);
adminRouter.patch("/users/:id/status", adminController.updateUserStatus);
adminRouter.delete("/users/:id", adminController.deleteUser);

// manajemen kegiatan oleh admin
adminRouter.get("/events", adminController.listEvents);
adminRouter.get("/events/:id", adminController.getEventById);
adminRouter.put("/events/:id", adminController.updateEvent);
adminRouter.delete("/events/:id", adminController.deleteEvent);

// manajemen sertifikat oleh admin
adminRouter.post("/certificates/bulk-revoke", adminController.bulkRevoke);
adminRouter.get("/certificates", adminController.listCertificates);
adminRouter.get("/certificates/:id", adminController.getCertificateById);
adminRouter.patch(
  "/certificates/:id/revoke",
  adminController.revokeCertificate,
);

// log verifikasi untuk admin
adminRouter.get(
  "/verification-logs",
  verificationController.getVerificationLogs,
);
