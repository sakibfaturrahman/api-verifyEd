import { Router } from 'express';
import multer from 'multer';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { VerificationRepository } from './verification.repository';
import { verifyRateLimit } from '../../core/middleware/rateLimit.middleware';
import { certRepository } from '../certificates/certificate.routes';
import { env } from '../../config/env';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

const verificationRepository = new VerificationRepository();
export const verificationService = new VerificationService(certRepository, verificationRepository);
const verificationController = new VerificationController(verificationService);

// Apply strict rate limiting to all verification routes (public)
router.use(verifyRateLimit);

// Public — no authentication required
router.get('/certificate/:certificateNumber', verificationController.verifyByCertificateNumber);
router.get('/qr/:qrToken', verificationController.verifyByQr);
router.post('/pdf', upload.single('file'), verificationController.verifyByPdf);

export default router;
