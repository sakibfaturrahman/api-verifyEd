import { Request, Response, NextFunction } from 'express';
import { VerificationService } from './verification.service';
import { successResponse } from '../../core/utils/response';
import { AppError } from '../../core/errors/AppError';

export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  private getMeta(req: Request) {
    return {
      ip: req.ip ?? req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };
  }

  /**
   * @openapi
   * /api/v1/verify/certificate/{certificateNumber}:
   *   get:
   *     tags: [Verification]
   *     summary: Verify a certificate by its certificate number
   *     description: Public endpoint — no authentication required
   *     parameters:
   *       - in: path
   *         name: certificateNumber
   *         required: true
   *         schema: { type: string }
   *         example: CERT-20240615-AABBCCDD
   *     responses:
   *       200:
   *         description: Verification result
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/VerificationResult'
   */
  verifyByCertificateNumber = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.verificationService.verifyByCertificateNumber(
        String(req.params.certificateNumber),
        this.getMeta(req),
      );
      successResponse({ res, message: 'Verification complete', data: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/verify/qr/{qrToken}:
   *   get:
   *     tags: [Verification]
   *     summary: Verify a certificate by QR token
   *     description: Public endpoint — no authentication required. This is the URL embedded in QR codes.
   *     parameters:
   *       - in: path
   *         name: qrToken
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Verification result
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/VerificationResult'
   */
  verifyByQr = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.verificationService.verifyByQrToken(
        String(req.params.qrToken),
        this.getMeta(req),
      );
      successResponse({ res, message: 'Verification complete', data: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/verify/pdf:
   *   post:
   *     tags: [Verification]
   *     summary: Verify a certificate by uploading the PDF
   *     description: |
   *       Public endpoint — no authentication required.
   *       Calculates SHA-256 of the uploaded PDF and compares with stored hash.
   *       If the PDF has been modified in any way, integrity will be 'invalid'.
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [file]
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: The PDF certificate to verify
   *     responses:
   *       200:
   *         description: Verification result with documentIntegrity field
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/VerificationResult'
   *       400:
   *         description: Invalid file (not a PDF or corrupted)
   */
  verifyByPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new AppError('PDF file is required', 400, 'FILE_REQUIRED');
      }
      const result = await this.verificationService.verifyByPdf(req.file, this.getMeta(req));
      successResponse({ res, message: 'Verification complete', data: result });
    } catch (err) {
      next(err);
    }
  };
}
