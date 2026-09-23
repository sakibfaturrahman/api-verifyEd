import {
  CertificateRepository,
  CertificateRow,
  CertificateWithEvent,
} from "./certificate.repository";
import { EventService } from "../events/event.service";
import { NotificationService } from "../notifications/notification.service";
import {
  RevokeCertificateDto,
  QrConfigDto,
  QrConfig,
  ListCertificatesQuery,
} from "./certificate.validation";
import { embedQrCodeInPdf } from "./certificate.generator";
import { sha256 } from "../../core/utils/hash";
import {
  generateSecureToken,
  generateCertificateNumber,
} from "../../core/utils/token";
import { buildStoragePath, validatePdfFile } from "../../core/utils/file";
import {
  parsePagination,
  buildPaginationMeta,
} from "../../core/utils/pagination";
import { NotFoundError } from "../../core/errors/NotFoundError";
import { ForbiddenError } from "../../core/errors/ForbiddenError";
import { AppError } from "../../core/errors/AppError";
import { env } from "../../config/env";
import { logger } from "../../app";

export interface UploadCertificateDto {
  event_id: string;
  recipient_name: string;
  qr_config?: QrConfig;
}

export interface SingleUploadResult {
  certificate: CertificateWithEvent;
}

export interface BulkUploadFileResult {
  file: string;
  status: "success" | "failed";
  certificateNumber?: string;
  error?: string;
}

export interface BulkUploadResult {
  total: number;
  successful: number;
  failed: number;
  results: BulkUploadFileResult[];
}

export class CertificateService {
  constructor(
    private readonly certRepository: CertificateRepository,
    private readonly eventService: EventService,
    private readonly notificationService: NotificationService,
  ) {}

  // alur unggah dan generasi sertifikat tunggal
  async uploadCertificate(
    userId: string,
    dto: UploadCertificateDto,
    file: Express.Multer.File,
    verifyBaseUrl: string,
  ): Promise<SingleUploadResult> {
    const validation = validatePdfFile(
      file.originalname,
      file.mimetype,
      file.buffer,
      env.MAX_FILE_SIZE,
    );
    if (!validation.valid) {
      throw new AppError(validation.error!, 400, "INVALID_FILE");
    }

    const event = await this.eventService.assertEventOwnership(dto.event_id, userId);

    const certificateNumber = generateCertificateNumber();
    const qrToken = generateSecureToken(32);

    const certificate = await this.certRepository.create({
      event_id: dto.event_id,
      certificate_number: certificateNumber,
      recipient_name: dto.recipient_name,
      qr_token: qrToken,
      qr_config: dto.qr_config as QrConfig | undefined,
    });

    const originalPath = buildStoragePath(
      userId,
      dto.event_id,
      certificate.id,
      "original",
    );
    const generatedPath = buildStoragePath(
      userId,
      dto.event_id,
      certificate.id,
      "generated",
    );

    try {
      await this.certRepository.uploadFile(
        env.SUPABASE_STORAGE_BUCKET_ORIGINAL,
        originalPath,
        file.buffer,
        "application/pdf",
      );

      const { generatedPdfBuffer, appliedConfig } = await embedQrCodeInPdf({
        pdfBuffer: file.buffer,
        certificateNumber,
        qrToken,
        verifyBaseUrl,
        qrConfig: dto.qr_config as QrConfig | undefined,
      });

      const generatedFileHash = sha256(generatedPdfBuffer);

      await this.certRepository.uploadFile(
        env.SUPABASE_STORAGE_BUCKET_GENERATED,
        generatedPath,
        generatedPdfBuffer,
        "application/pdf",
      );

      await this.certRepository.updateFileInfo(certificate.id, {
        original_file: originalPath,
        generated_file: generatedPath,
        file_hash: generatedFileHash,
        qr_config: appliedConfig,
      });

      logger.info(
        { certificateId: certificate.id, certificateNumber },
        "Certificate uploaded and generated",
      );

      const full = await this.certRepository.findById(certificate.id);
      return { certificate: full! };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Gagal memproses berkas PDF";
      logger.error(
        { certificateId: certificate.id, err },
        "Certificate upload failed, cleaning up",
      );

      // picu notifikasi kegagalan pemrosesan berkas stempel qr
      this.notificationService
        .notify({
          title: "Kegagalan Pemrosesan Berkas",
          message: `Gagal menyematkan stempel QR pada dokumen peserta ${dto.recipient_name}: ${errorMessage}`,
          type: "tampered_document",
          severity: "medium",
          metadata: { eventId: dto.event_id, fileName: file.originalname, error: errorMessage },
        })
        .catch(() => {});

      await this.certRepository
        .deleteFile(env.SUPABASE_STORAGE_BUCKET_ORIGINAL, originalPath)
        .catch(() => {});
      await this.certRepository
        .deleteFile(env.SUPABASE_STORAGE_BUCKET_GENERATED, generatedPath)
        .catch(() => {});

      const { supabase } = await import("../../config/supabase");
      await supabase.from("certificates").delete().eq("id", certificate.id);
      throw err;
    }
  }

  // alur unggah sertifikat massal
  async bulkUploadCertificates(
    userId: string,
    eventId: string,
    recipientNames: string[],
    files: Express.Multer.File[],
    verifyBaseUrl: string,
  ): Promise<BulkUploadResult> {
    const results: BulkUploadFileResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const recipientName =
        recipientNames[i] ?? file.originalname.replace(".pdf", "");

      try {
        const uploadResult = await this.uploadCertificate(
          userId,
          {
            event_id: eventId,
            recipient_name: recipientName,
            qr_config: undefined,
          },
          file,
          verifyBaseUrl,
        );

        results.push({
          file: file.originalname,
          status: "success",
          certificateNumber: uploadResult.certificate.certificate_number,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({
          file: file.originalname,
          status: "failed",
          error: message,
        });
      }
    }

    const successfulCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    // picu notifikasi jika penerbitan massal berjumlah banyak
    if (successfulCount >= 10) {
      this.notificationService
        .notifyBulkIssuance({
          eventTitle: `Event ID: ${eventId}`,
          organizerName: `User ID: ${userId}`,
          totalCount: successfulCount,
        })
        .catch(() => {});
    }

    return {
      total: files.length,
      successful: successfulCount,
      failed: failedCount,
      results,
    };
  }

  // ambil daftar sertifikat milik pengguna dengan paginasi
  async listCertificates(userId: string, query: ListCertificatesQuery) {
    const { page, limit, offset } = parsePagination(query.page, query.limit);
    const { data, total } = await this.certRepository.findAll({
      userId,
      page,
      limit,
      offset,
      search: query.search,
      status: query.status,
      eventId: query.event_id,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  // ambil satu sertifikat berdasarkan id
  async getCertificateById(
    id: string,
    userId: string,
    isAdmin = false,
  ): Promise<CertificateWithEvent> {
    const cert = await this.certRepository.findById(id);
    if (!cert) throw new NotFoundError("Certificate");

    if (!isAdmin && cert.events.user_id !== userId) {
      throw new ForbiddenError("You do not have access to this certificate");
    }

    return cert;
  }

  // dapatkan signed url berkas pdf untuk diunduh
  async downloadCertificate(
    id: string,
    userId: string,
    isAdmin = false,
  ): Promise<string> {
    const cert = await this.getCertificateById(id, userId, isAdmin);

    const filePath = cert.generated_file ?? cert.original_file;
    if (!filePath) {
      throw new AppError(
        "No file available for this certificate",
        404,
        "FILE_NOT_FOUND",
      );
    }

    const bucket = cert.generated_file
      ? env.SUPABASE_STORAGE_BUCKET_GENERATED
      : env.SUPABASE_STORAGE_BUCKET_ORIGINAL;

    return this.certRepository.getSignedUrl(
      filePath,
      bucket,
      env.SIGNED_URL_EXPIRY,
    );
  }

  // batalkan atau cabut status keabsahan sertifikat
  async revokeCertificate(
    id: string,
    userId: string,
    dto: RevokeCertificateDto,
    isAdmin = false,
  ): Promise<CertificateRow> {
    const cert = await this.getCertificateById(id, userId, isAdmin);

    if (cert.status === "revoked") {
      throw new AppError(
        "Certificate is already revoked",
        409,
        "ALREADY_REVOKED",
      );
    }

    logger.info({ certificateId: id, userId }, "Certificate revoked");
    return this.certRepository.revoke(id, dto.reason);
  }

  // buat ulang berkas sertifikat dengan berkas pdf baru
  async regenerateCertificate(
    id: string,
    userId: string,
    file: Express.Multer.File,
    verifyBaseUrl: string,
  ): Promise<CertificateWithEvent> {
    const cert = await this.getCertificateById(id, userId);

    const validation = validatePdfFile(
      file.originalname,
      file.mimetype,
      file.buffer,
      env.MAX_FILE_SIZE,
    );
    if (!validation.valid) {
      throw new AppError(validation.error!, 400, "INVALID_FILE");
    }

    const originalPath = buildStoragePath(
      userId,
      cert.event_id,
      cert.id,
      "original",
    );
    const generatedPath = buildStoragePath(
      userId,
      cert.event_id,
      cert.id,
      "generated",
    );

    if (cert.generated_file) {
      await this.certRepository
        .deleteFile(env.SUPABASE_STORAGE_BUCKET_GENERATED, generatedPath)
        .catch(() => {});
    }

    await this.certRepository.uploadFile(
      env.SUPABASE_STORAGE_BUCKET_ORIGINAL,
      originalPath,
      file.buffer,
      "application/pdf",
    );

    const { generatedPdfBuffer, appliedConfig } = await embedQrCodeInPdf({
      pdfBuffer: file.buffer,
      certificateNumber: cert.certificate_number,
      qrToken: cert.qr_token,
      verifyBaseUrl,
      qrConfig: cert.qr_config ?? undefined,
    });

    const newGeneratedFileHash = sha256(generatedPdfBuffer);

    await this.certRepository.uploadFile(
      env.SUPABASE_STORAGE_BUCKET_GENERATED,
      generatedPath,
      generatedPdfBuffer,
      "application/pdf",
    );

    await this.certRepository.updateFileInfo(cert.id, {
      original_file: originalPath,
      generated_file: generatedPath,
      file_hash: newGeneratedFileHash,
      qr_config: appliedConfig,
    });

    logger.info({ certificateId: id }, "Certificate regenerated");

    return (await this.certRepository.findById(id))!;
  }

  // simpan koordinat posisi barcode qr
  async saveQrConfig(
    certificateId: string,
    userId: string,
    config: QrConfigDto,
  ): Promise<CertificateRow> {
    const cert = await this.certRepository.findById(certificateId);
    if (!cert) throw new NotFoundError("Certificate");
    if (cert.events.user_id !== userId)
      throw new ForbiddenError("Not your certificate");

    return this.certRepository.updateQrConfig(certificateId, {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      page: config.page,
      rotation: config.rotation,
    });
  }

  // hapus sertifikat beserta file fisiknya di storage bucket
  async deleteCertificate(
    id: string,
    userId: string,
    isAdmin = false,
  ): Promise<void> {
    const cert = await this.getCertificateById(id, userId, isAdmin);

    if (cert.original_file) {
      await this.certRepository
        .deleteFile(env.SUPABASE_STORAGE_BUCKET_ORIGINAL, cert.original_file)
        .catch((err) => {
          logger.warn({ err, file: cert.original_file }, "failed to remove original storage file");
        });
    }

    if (cert.generated_file) {
      await this.certRepository
        .deleteFile(env.SUPABASE_STORAGE_BUCKET_GENERATED, cert.generated_file)
        .catch((err) => {
          logger.warn({ err, file: cert.generated_file }, "failed to remove generated storage file");
        });
    }

    await this.certRepository.delete(id);
    logger.info({ certificateId: id, userId }, "certificate deleted successfully");
  }

  // ambil seluruh sertifikat sistem untuk kebutuhan admin
  async listAllCertificates(query: ListCertificatesQuery) {
    const { page, limit, offset } = parsePagination(query.page, query.limit);
    const { data, total } = await this.certRepository.findAll({
      page,
      limit,
      offset,
      search: query.search,
      status: query.status,
      eventId: query.event_id,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  // pencabutan sertifikat massal oleh admin
  async bulkRevoke(
    ids: string[],
    reason: string,
    adminEmail = "Super Admin",
  ): Promise<{ revoked: number }> {
    const results = await this.certRepository.bulkRevoke(ids, reason);
    logger.info({ count: results.length, reason }, "Bulk revoke performed");

    // picu notifikasi pencabutan massal jika ada dokumen yang dibatalkan
    if (results.length > 0) {
      this.notificationService
        .notifyBulkRevoke({
          totalRevoked: results.length,
          reason,
          adminOrUser: adminEmail,
        })
        .catch(() => {});
    }

    return { revoked: results.length };
  }
}