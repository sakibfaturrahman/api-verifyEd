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

// Inisialisasi service & controller
const dashboardRepository = new DashboardRepository();
const verificationRepository = new VerificationRepository();
export const dashboardService = new DashboardService(
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

// ── Rute Dasbor Pengguna (/api/v1/dashboard/user) ───────────────────────────
router.get(
  "/user",
  authenticate,
  authorize("admin", "user"),
  dashboardController.getUserDashboard,
);

export default router;

// ── Router Admin (/api/v1/admin) ───────────────────────────────────────────
export const adminRouter = Router();

adminRouter.use(authenticate, authorize("admin"));

// Ringkasan Dasbor Admin
adminRouter.get("/dashboard", dashboardController.getAdminDashboard);

// Manajemen Pengguna (Mitra & Instansi)
adminRouter.get("/users", adminController.listUsers);
adminRouter.get("/users/:id", adminController.getUserById);
adminRouter.patch("/users/:id/status", adminController.updateUserStatus);
adminRouter.delete("/users/:id", adminController.deleteUser);

// Manajemen Kegiatan / Agenda Acara
adminRouter.get("/events", adminController.listEvents);
adminRouter.get("/events/:id", adminController.getEventById);
adminRouter.put("/events/:id", adminController.updateEvent);
adminRouter.delete("/events/:id", adminController.deleteEvent);

// Manajemen Sertifikat Platform
adminRouter.post("/certificates/bulk-revoke", adminController.bulkRevoke);
adminRouter.get("/certificates", adminController.listCertificates);
adminRouter.get("/certificates/:id", adminController.getCertificateById);
adminRouter.patch(
  "/certificates/:id/revoke",
  adminController.revokeCertificate,
);

// Log Audit Pemeriksaan Verifikasi
adminRouter.get(
  "/verification-logs",
  verificationController.getVerificationLogs,
);
