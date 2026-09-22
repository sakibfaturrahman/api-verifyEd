import { Router } from "express";
import multer from "multer";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";
import { VerificationRepository } from "./verification.repository";
import { NotificationRepository } from "../notifications/notification.repository";
import { NotificationService } from "../notifications/notification.service";
import { verifyRateLimit } from "../../core/middleware/rateLimit.middleware";
import {
  authenticate,
  requireRole,
} from "../../core/middleware/auth.middleware";
import { certRepository } from "../certificates/certificate.routes";
import { env } from "../../config/env";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// inisialisasi dependensi service
const verificationRepository = new VerificationRepository();
const notificationRepository = new NotificationRepository();
export const notificationService = new NotificationService(
  notificationRepository,
);

export const verificationService = new VerificationService(
  certRepository,
  verificationRepository,
  notificationService,
);

const verificationController = new VerificationController(verificationService);

// rute log verifikasi untuk admin
router.get(
  "/verification-logs",
  authenticate,
  requireRole(["admin"]),
  verificationController.getVerificationLogs,
);

// pembatasan laju akses untuk endpoint publik
router.use(verifyRateLimit);

// endpoint publik verifikasi sertifikat
router.get(
  "/certificate/:certificateNumber",
  verificationController.verifyByCertificateNumber,
);
router.get("/qr/:qrToken", verificationController.verifyByQr);
router.post("/pdf", upload.single("file"), verificationController.verifyByPdf);

export default router;
