import { Request, Response, NextFunction } from "express";
import { CertificateService } from "./certificate.service";
import { successResponse } from "../../core/utils/response";
import { AppError } from "../../core/errors/AppError";
import { parseSchema } from "../../core/middleware/validation.middleware";
import {
  revokeCertificateSchema,
  qrConfigSchema,
  listCertificatesQuerySchema,
  QrConfig,
} from "./certificate.validation";
import { z } from "zod";

// Inline schema for upload that accepts qr_config as a JSON string (multipart form)
const uploadCertificateBodySchema = z.object({
  event_id: z.string().uuid("event_id must be a valid UUID"),
  recipient_name: z.string().min(1, "Recipient name is required").max(255),
  qr_config: z.string().optional(),
});

function parseQrConfig(raw: string | undefined): QrConfig | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as QrConfig;
  } catch {
    return undefined;
  }
}

function toStr(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined;
}

export class CertificateController {
  constructor(private readonly certService: CertificateService) {}

  private getVerifyBaseUrl(req: Request): string {
    return `${req.protocol}://${req.get("host")}`;
  }

  /**
   * @openapi
   * /api/v1/certificates:
   *   get:
   *     tags: [Certificates]
   *     summary: List certificates belonging to the authenticated user
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer }
   *       - in: query
   *         name: limit
   *         schema: { type: integer }
   *       - in: query
   *         name: search
   *         schema: { type: string }
   *       - in: query
   *         name: status
   *         schema: { type: string, enum: [active, revoked] }
   *       - in: query
   *         name: event_id
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Paginated certificate list
   */
  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = parseSchema(listCertificatesQuerySchema, req.query);
      const result = await this.certService.listCertificates(
        req.user!.id,
        query,
      );
      successResponse({
        res,
        message: "Certificates retrieved successfully",
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/certificates/{id}:
   *   get:
   *     tags: [Certificates]
   *     summary: Get certificate by ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Certificate details
   *       404:
   *         description: Certificate not found
   */
  getById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const cert = await this.certService.getCertificateById(
        req.params.id,
        req.user!.id,
      );
      successResponse({
        res,
        message: "Certificate retrieved successfully",
        data: cert,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/certificates/upload:
   *   post:
   *     tags: [Certificates]
   *     summary: Upload a single PDF certificate
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [event_id, recipient_name, file]
   *             properties:
   *               event_id: { type: string, format: uuid }
   *               recipient_name: { type: string }
   *               qr_config:
   *                 type: string
   *                 description: JSON string - {"x":450,"y":30,"width":100,"height":100,"page":1}
   *               file: { type: string, format: binary }
   *     responses:
   *       201:
   *         description: Certificate uploaded and generated
   */
  upload = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.file) {
        throw new AppError("PDF file is required", 400, "FILE_REQUIRED");
      }
      const body = parseSchema(uploadCertificateBodySchema, req.body);
      const qrConfig = parseQrConfig(body.qr_config);
      const result = await this.certService.uploadCertificate(
        req.user!.id,
        {
          event_id: body.event_id,
          recipient_name: body.recipient_name,
          qr_config: qrConfig,
        },
        req.file,
        this.getVerifyBaseUrl(req),
      );
      successResponse({
        res,
        message: "Certificate uploaded and generated successfully",
        data: result.certificate,
        statusCode: 201,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/certificates/upload/bulk:
   *   post:
   *     tags: [Certificates]
   *     summary: Bulk upload multiple PDF certificates
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [event_id, files]
   *             properties:
   *               event_id: { type: string, format: uuid }
   *               recipient_names:
   *                 type: string
   *                 description: JSON array - ["Alice","Bob"]
   *               files:
   *                 type: array
   *                 items: { type: string, format: binary }
   *     responses:
   *       207:
   *         description: Multi-status bulk upload result
   */
  bulkUpload = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError(
          "At least one PDF file is required",
          400,
          "FILES_REQUIRED",
        );
      }

      const eventId = toStr(req.body.event_id);
      if (!eventId) {
        throw new AppError("event_id is required", 400, "EVENT_ID_REQUIRED");
      }

      let recipientNames: string[] = [];
      const rawNames = req.body.recipient_names;
      if (typeof rawNames === "string") {
        try {
          recipientNames = JSON.parse(rawNames) as string[];
        } catch {
          recipientNames = [];
        }
      }

      const result = await this.certService.bulkUploadCertificates(
        req.user!.id,
        eventId,
        recipientNames,
        files,
        this.getVerifyBaseUrl(req),
      );

      const statusCode =
        result.failed > 0 && result.successful > 0
          ? 207
          : result.failed > 0
            ? 400
            : 201;
      successResponse({
        res,
        message: "Bulk upload completed",
        data: result,
        statusCode,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/certificates/{id}/download:
   *   get:
   *     tags: [Certificates]
   *     summary: Get a signed download URL for a certificate PDF
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Signed download URL (1 hour expiry)
   */
  download = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signedUrl = await this.certService.downloadCertificate(
        req.params.id,
        req.user!.id,
      );
      successResponse({
        res,
        message: "Download URL generated",
        data: { url: signedUrl, expiresIn: 3600 },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/certificates/{id}/revoke:
   *   patch:
   *     tags: [Certificates]
   *     summary: Revoke a certificate
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [reason]
   *             properties:
   *               reason: { type: string }
   *     responses:
   *       200:
   *         description: Certificate revoked
   *       409:
   *         description: Already revoked
   */
  revoke = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = parseSchema(revokeCertificateSchema, req.body);
      const cert = await this.certService.revokeCertificate(
        req.params.id,
        req.user!.id,
        dto,
      );
      successResponse({
        res,
        message: "Certificate revoked successfully",
        data: cert,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/certificates/{id}/regenerate:
   *   post:
   *     tags: [Certificates]
   *     summary: Regenerate certificate PDF with new file
   *     description: Preserves Certificate ID and QR token. New PDF + new hash.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [file]
   *             properties:
   *               file: { type: string, format: binary }
   *     responses:
   *       200:
   *         description: Certificate regenerated
   */
  regenerate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.file) {
        throw new AppError("PDF file is required", 400, "FILE_REQUIRED");
      }
      const cert = await this.certService.regenerateCertificate(
        req.params.id,
        req.user!.id,
        req.file,
        this.getVerifyBaseUrl(req),
      );
      successResponse({
        res,
        message: "Certificate regenerated successfully",
        data: cert,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/certificates/qr-config:
   *   post:
   *     tags: [Certificates]
   *     summary: Save QR code placement configuration
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [certificate_id, x, y, width, height]
   *             properties:
   *               certificate_id: { type: string, format: uuid }
   *               x: { type: number }
   *               y: { type: number }
   *               width: { type: number }
   *               height: { type: number }
   *               page: { type: integer, default: 1 }
   *               rotation: { type: number, default: 0 }
   *     responses:
   *       200:
   *         description: QR config saved
   */
  saveQrConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const raw = parseSchema(qrConfigSchema, req.body);
      // Ensure defaults are applied
      const dto = { ...raw, page: raw.page ?? 1, rotation: raw.rotation ?? 0 };
      const cert = await this.certService.saveQrConfig(
        dto.certificate_id,
        req.user!.id,
        dto,
      );
      successResponse({
        res,
        message: "QR configuration saved successfully",
        data: cert,
      });
    } catch (err) {
      next(err);
    }
  };

  // penanganan permintaan hapus sertifikat
  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const isAdmin = req.user?.role === "admin";
      await this.certService.deleteCertificate(
        req.params.id,
        req.user!.id,
        isAdmin,
      );
      successResponse({ res, message: "Certificate deleted successfully" });
    } catch (err) {
      next(err);
    }
  };
}
