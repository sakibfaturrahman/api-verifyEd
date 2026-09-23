import { Router } from "express";
import multer from "multer";
import { CertificateController } from "./certificate.controller";
import { CertificateService } from "./certificate.service";
import { CertificateRepository } from "./certificate.repository";
import { eventService } from "../events/event.routes";
import { notificationService } from "../notifications/notification.routes";
import { authenticate } from "../../core/middleware/auth.middleware";
import { env } from "../../config/env";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

export const certRepository = new CertificateRepository();
export const certService = new CertificateService(
  certRepository,
  eventService,
  notificationService,
);
const certificateController = new CertificateController(certService);

// seluruh rute sertifikat di bawah ini membutuhkan autentikasi
router.use(authenticate);

router.get("/", certificateController.list);
router.get("/:id", certificateController.getById);
router.get("/:id/download", certificateController.download);
router.post("/upload", upload.single("file"), certificateController.upload);
router.post(
  "/upload/bulk",
  upload.array("files", env.MAX_BULK_FILES),
  certificateController.bulkUpload,
);
router.patch("/:id/revoke", certificateController.revoke);
router.post(
  "/:id/regenerate",
  upload.single("file"),
  certificateController.regenerate,
);
router.post("/qr-config", certificateController.saveQrConfig);
router.delete("/:id", certificateController.delete);

export default router;
