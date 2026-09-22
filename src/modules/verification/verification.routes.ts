import { Router } from "express";
import multer from "multer";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";
import { VerificationRepository } from "./verification.repository";
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

const verificationRepository = new VerificationRepository();
export const verificationService = new VerificationService(
  certRepository,
  verificationRepository,
);
const verificationController = new VerificationController(verificationService);

// Admin Endpoint — Diperlukan Autentikasi Admin (Ditaruh sebelum rate limiter publik)
router.get(
  "/admin/verification-logs",
  authenticate,
  requireRole(["admin"]),
  verificationController.getVerificationLogs,
);

// Alternatif path jika router ini sudah di-mount di /api/v1/admin
router.get(
  "/verification-logs",
  authenticate,
  requireRole(["admin"]),
  verificationController.getVerificationLogs,
);

// Terapkan rate limit ketat hanya untuk endpoint verifikasi publik di bawahnya
router.use(verifyRateLimit);

// Public — Tidak butuh autentikasi
router.get(
  "/certificate/:certificateNumber",
  verificationController.verifyByCertificateNumber,
);
router.get("/qr/:qrToken", verificationController.verifyByQr);
router.post("/pdf", upload.single("file"), verificationController.verifyByPdf);

export default router;
