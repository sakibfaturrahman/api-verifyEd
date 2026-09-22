import { Router } from "express";
import multer from "multer";
import { CertificateController } from "./certificate.controller";
import { CertificateService } from "./certificate.service";
import { CertificateRepository } from "./certificate.repository";
import { authenticate } from "../../core/middleware/auth.middleware";
import { authorize } from "../../core/middleware/role.middleware";
import { env } from "../../config/env";
import { eventService } from "../events/event.routes";

const router = Router();

// Multer configured for memory storage — no disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: env.MAX_BULK_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

export const certRepository = new CertificateRepository();
export const certService = new CertificateService(certRepository, eventService);
const certController = new CertificateController(certService);

// All certificate routes require authentication
router.use(authenticate);
router.use(authorize("admin", "user"));

// Important: specific routes before parameterized routes
router.post("/qr-config", certController.saveQrConfig);
router.post("/upload", upload.single("file"), certController.upload);
router.post(
  "/upload/bulk",
  upload.array("files", env.MAX_BULK_FILES),
  certController.bulkUpload,
);

router.delete("/:id", certController.delete);

router.get("/", certController.list);
router.get("/:id", certController.getById);
router.get("/:id/download", certController.download);
router.patch("/:id/revoke", certController.revoke);
router.post(
  "/:id/regenerate",
  upload.single("file"),
  certController.regenerate,
);

export default router;
