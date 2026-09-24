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
    return (
      process.env.FRONTEND_URL ||
      req.headers.origin ||
      `${req.protocol}://${req.get("host")}`
    );
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = parseSchema(listCertificatesQuerySchema, req.query);
      const result = await this.certService.listCertificates(req.user!.id, query);
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

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cert = await this.certService.getCertificateById(req.params.id, req.user!.id);
      successResponse({
        res,
        message: "Certificate retrieved successfully",
        data: cert,
      });
    } catch (err) {
      next(err);
    }
  };

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

  bulkUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError("At least one PDF file is required", 400, "FILES_REQUIRED");
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
      } else if (Array.isArray(rawNames)) {
        recipientNames = rawNames as string[];
      }

      // Parsing qr_config dari payload bulk upload
      const qrConfig = parseQrConfig(toStr(req.body.qr_config));

      const result = await this.certService.bulkUploadCertificates(
        req.user!.id,
        eventId,
        recipientNames,
        files,
        this.getVerifyBaseUrl(req),
        qrConfig, // Teruskan konfigurasi QR ke service
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

  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

  regenerate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

  saveQrConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const raw = parseSchema(qrConfigSchema, req.body);
      const dto = { ...raw, page: raw.page ?? 1, rotation: raw.rotation ?? 0 };
      const cert = await this.certService.saveQrConfig(dto.certificate_id, req.user!.id, dto);
      successResponse({
        res,
        message: "QR configuration saved successfully",
        data: cert,
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAdmin = req.user?.role === "admin";
      await this.certService.deleteCertificate(req.params.id, req.user!.id, isAdmin);
      successResponse({ res, message: "Certificate deleted successfully" });
    } catch (err) {
      next(err);
    }
  };
}