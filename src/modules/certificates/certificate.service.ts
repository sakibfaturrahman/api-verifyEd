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
  // Nama bucket aman dengan fallback ke "certificates"
  private readonly bucketOriginal =
    env.SUPABASE_STORAGE_BUCKET_ORIGINAL || "certificates";
  private readonly bucketGenerated =
    env.SUPABASE_STORAGE_BUCKET_GENERATED || "certificates";

  constructor(
    private readonly certRepository: CertificateRepository,
    private readonly eventService: EventService,
    private readonly notificationService: NotificationService,
  ) {}

  // Helper verifikasi kepemilikan sertifikat yang aman
  private checkOwnership(
    cert: CertificateWithEvent,
    userId: string,
    isAdmin: boolean,
  ): void {
    if (isAdmin) return;

    // Menangani variasi penamaan relasi (events / event) atau pengecekan via event_id
    const ownerId =
      (cert as any).events?.user_id ||
      (cert as any).event?.user_id ||
      (cert as any).user_id;

    if (ownerId && ownerId !== userId) {
      throw new ForbiddenError("Anda tidak memiliki akses ke sertifikat ini.");
    }
  }

  // Alur unggah dan generasi sertifikat tunggal
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

    const event = await this.eventService.assertEventOwnership(
      dto.event_id,
      userId,
    );

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
      // 1. Unggah PDF Original
      await this.certRepository.uploadFile(
        this.bucketOriginal,
        originalPath,
        file.buffer,
        "application/pdf",
      );

      // 2. Sematkan QR Code pada PDF
      const { generatedPdfBuffer, appliedConfig } = await embedQrCodeInPdf({
        pdfBuffer: file.buffer,
        certificateNumber,
        qrToken,
        verifyBaseUrl,
        qrConfig: dto.qr_config as QrConfig | undefined,
      });

      const generatedFileHash = sha256(generatedPdfBuffer);

      // 3. Unggah PDF yang sudah memiliki QR
      await this.certRepository.uploadFile(
        this.bucketGenerated,
        generatedPath,
        generatedPdfBuffer,
        "application/pdf",
      );

      // 4. Update data file dan hash di database
      await this.certRepository.updateFileInfo(certificate.id, {
        original_file: originalPath,
        generated_file: generatedPath,
        file_hash: generatedFileHash,
        qr_config: appliedConfig,
      });

      logger.info(
        { certificateId: certificate.id, certificateNumber },
        "Certificate uploaded and generated successfully",
      );

      // Notifikasi ke user
      try {
        await this.notificationService.notifyUserCertificateIssued(userId, {
          certificateNumber,
          recipientName: dto.recipient_name,
          eventName: event.name,
        });
      } catch (notifErr) {
        logger.warn(
          { notifErr, certificateNumber },
          "Failed to send user certificate issued notification",
        );
      }

      const full = await this.certRepository.findById(certificate.id);
      return { certificate: full! };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Gagal memproses berkas PDF";
      logger.error(
        { certificateId: certificate.id, err },
        "Certificate upload failed, cleaning up artifacts",
      );

      // Notifikasi kegagalan
      try {
        await this.notificationService.notifyUserProcessingFailed(userId, {
          fileName: file.originalname,
          error: errorMessage,
        });
      } catch (notifErr) {
        logger.warn(
          { notifErr, fileName: file.originalname },
          "Failed to send user processing failed notification",
        );
      }

      // Rollback file jika sempat terunggah
      try {
        await this.certRepository.deleteFile(this.bucketOriginal, originalPath);
      } catch {}

      try {
        await this.certRepository.deleteFile(
          this.bucketGenerated,
          generatedPath,
        );
      } catch {}

      // Hapus row sertifikat yang gagal (tanpa .catch())
      try {
        const { supabase } = await import("../../config/supabase");
        await supabase.from("certificates").delete().eq("id", certificate.id);
      } catch {}

      throw err;
    }
  }

  // Alur unggah sertifikat massal
  async bulkUploadCertificates(
    userId: string,
    eventId: string,
    recipientNames: string[],
    files: Express.Multer.File[],
    verifyBaseUrl: string,
    qrConfig?: QrConfig,
  ): Promise<BulkUploadResult> {
    const event = await this.eventService.assertEventOwnership(eventId, userId);
    const results: BulkUploadFileResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const recipientName =
        recipientNames[i] ?? file.originalname.replace(/\.pdf$/i, "");

      try {
        const uploadResult = await this.uploadCertificate(
          userId,
          {
            event_id: eventId,
            recipient_name: recipientName,
            qr_config: qrConfig,
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

    const successfulCount = results.filter(
      (r) => r.status === "success",
    ).length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    try {
      await this.notificationService.notifyUserBulkUploadCompleted(userId, {
        eventName: event.name,
        successful: successfulCount,
        failed: failedCount,
      });
    } catch (notifErr) {
      logger.warn(
        { notifErr, eventId },
        "Failed to send user bulk upload notification",
      );
    }

    if (successfulCount >= 10) {
      try {
        await this.notificationService.notifyBulkIssuance({
          eventTitle: event.name,
          organizerName: event.organizer || `User ID: ${userId}`,
          totalCount: successfulCount,
        });
      } catch (notifErr) {
        logger.warn(
          { notifErr, eventId },
          "Failed to send admin bulk issuance notification",
        );
      }
    }

    return {
      total: files.length,
      successful: successfulCount,
      failed: failedCount,
      results,
    };
  }

  // Ambil daftar sertifikat milik user dengan paginasi
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

  // Ambil satu sertifikat berdasarkan ID
  async getCertificateById(
    id: string,
    userId: string,
    isAdmin = false,
  ): Promise<CertificateWithEvent> {
    const cert = await this.certRepository.findById(id);
    if (!cert) throw new NotFoundError("Certificate");

    this.checkOwnership(cert, userId, isAdmin);
    return cert;
  }

  // dapatkan signed url berkas pdf untuk diunduh secara aman
  async downloadCertificate(
    id: string,
    userId: string,
    isAdmin = false,
  ): Promise<string> {
    const cert = await this.getCertificateById(id, userId, isAdmin);

    let rawPath = cert.generated_file || cert.original_file;
    if (!rawPath) {
      throw new AppError(
        "Berkas PDF untuk sertifikat ini tidak ditemukan di database.",
        404,
        "FILE_NOT_FOUND",
      );
    }

    // Bersihkan prefix jika path tersimpan dengan awalan nama bucket
    let cleanPath = rawPath.trim();
    if (cleanPath.startsWith("certificates/")) {
      cleanPath = cleanPath.replace(/^certificates\//, "");
    }
    if (cleanPath.startsWith("/")) {
      cleanPath = cleanPath.substring(1);
    }

    const bucket = "certificates"; // Gunakan default bucket utama

    try {
      // Gunakan supabase client dengan service role jika ada agar kebal dari batasan RLS
      const { supabase } = await import("../../config/supabase");

      const cleanRecipient = (cert.recipient_name || "Peserta")
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      const downloadFileName = `Sertifikat - ${cleanRecipient} - ${cert.certificate_number}.pdf`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath, 3600, {
          download: downloadFileName,
        });

      if (error || !data?.signedUrl) {
        logger.warn(
          { error, cleanPath },
          "createSignedUrl gagal, mencoba fallback publicUrl",
        );
        // Fallback ke Public URL jika bucket diset sebagai public
        const { data: pubData } = supabase.storage
          .from(bucket)
          .getPublicUrl(cleanPath);

        if (pubData?.publicUrl) return pubData.publicUrl;
        throw error || new Error("Gagal membuat tautan unduhan berkas");
      }

      return data.signedUrl;
    } catch (err: unknown) {
      logger.error(
        { err, certId: id, path: cleanPath },
        "Download certificate failed",
      );
      throw new AppError(
        "Gagal mempersiapkan berkas unduhan dari storage server.",
        500,
        "STORAGE_DOWNLOAD_ERROR",
      );
    }
  }

  // Pencabutan status sertifikat
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

    const revokedCert = await this.certRepository.revoke(id, dto.reason);
    logger.info({ certificateId: id, userId }, "Certificate revoked");

    const ownerId =
      (cert as any).events?.user_id || (cert as any).event?.user_id || userId;

    try {
      await this.notificationService.notifyUserCertificateRevoked(ownerId, {
        certificateNumber: cert.certificate_number,
        recipientName: cert.recipient_name,
        reason: dto.reason,
      });
    } catch (notifErr) {
      logger.warn(
        { notifErr, certificateId: id },
        "Failed to send user certificate revoked notification",
      );
    }

    return revokedCert;
  }

  // Terapkan penempatan posisi QR baru dan re-render PDF
  async saveQrConfig(
    certificateId: string,
    userId: string,
    config: QrConfigDto,
    verifyBaseUrl = "https://verifyed.id",
  ): Promise<CertificateRow> {
    const cert = await this.certRepository.findById(certificateId);
    if (!cert) throw new NotFoundError("Certificate");
    this.checkOwnership(cert, userId, false);

    // 1. Simpan koordinat baru ke database
    const updatedCert = await this.certRepository.updateQrConfig(
      certificateId,
      {
        x: config.x,
        y: config.y,
        width: config.width,
        height: config.height,
        page: config.page,
        rotation: config.rotation,
      },
    );

    // 2. Jika ada berkas original, generate ulang PDF dengan koordinat baru
    if (cert.original_file) {
      try {
        const { supabase } = await import("../../config/supabase");
        const { data: fileBlob, error: downloadErr } = await supabase.storage
          .from(this.bucketOriginal)
          .download(cert.original_file);

        if (!downloadErr && fileBlob) {
          const originalBuffer = Buffer.from(await fileBlob.arrayBuffer());

          const { generatedPdfBuffer, appliedConfig } = await embedQrCodeInPdf({
            pdfBuffer: originalBuffer,
            certificateNumber: cert.certificate_number,
            qrToken: cert.qr_token,
            verifyBaseUrl,
            qrConfig: config as QrConfig,
          });

          const newHash = sha256(generatedPdfBuffer);
          const generatedPath =
            cert.generated_file ||
            buildStoragePath(userId, cert.event_id, cert.id, "generated");

          await this.certRepository.uploadFile(
            this.bucketGenerated,
            generatedPath,
            generatedPdfBuffer,
            "application/pdf",
          );

          await this.certRepository.updateFileInfo(cert.id, {
            generated_file: generatedPath,
            file_hash: newHash,
            qr_config: appliedConfig,
          });
        }
      } catch (genErr) {
        logger.warn(
          { genErr, certificateId },
          "Failed to re-render generated PDF during saveQrConfig, saved config only",
        );
      }
    }

    return updatedCert;
  }

  // Hapus sertifikat secara tuntas beserta relasi & berkas fisiknya
  // Hapus sertifikat secara tuntas beserta relasi & berkas fisiknya
  async deleteCertificate(
    id: string,
    userId: string,
    isAdmin = false,
  ): Promise<void> {
    const cert = await this.getCertificateById(id, userId, isAdmin);

    // 1. Bersihkan log verifikasi terkait terlebih dahulu (dengan penanganan error Supabase yang valid)
    try {
      const { supabase } = await import("../../config/supabase");
      const { error: logDeleteError } = await supabase
        .from("verification_logs")
        .delete()
        .eq("certificate_id", id);

      if (logDeleteError) {
        logger.warn(
          { err: logDeleteError, id },
          "Failed to clean up associated verification logs",
        );
      }
    } catch (err) {
      logger.warn(
        { err, id },
        "Exception while deleting associated verification logs",
      );
    }

    // 2. Hapus berkas fisik PDF di storage
    if (cert.original_file) {
      try {
        await this.certRepository.deleteFile(
          this.bucketOriginal,
          cert.original_file,
        );
      } catch (err) {
        logger.warn(
          { err, file: cert.original_file },
          "Failed to remove original storage file",
        );
      }
    }

    if (cert.generated_file) {
      try {
        await this.certRepository.deleteFile(
          this.bucketGenerated,
          cert.generated_file,
        );
      } catch (err) {
        logger.warn(
          { err, file: cert.generated_file },
          "Failed to remove generated storage file",
        );
      }
    }

    // 3. Hapus entri sertifikat dari database
    await this.certRepository.delete(id);
    logger.info(
      { certificateId: id, userId },
      "Certificate deleted successfully",
    );
  }

  // Ambil seluruh sertifikat sistem untuk kebutuhan admin
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

  // Pencabutan sertifikat massal oleh admin
  async bulkRevoke(
    ids: string[],
    reason: string,
    adminEmail = "Super Admin",
  ): Promise<{ revoked: number }> {
    const results = await this.certRepository.bulkRevoke(ids, reason);
    logger.info({ count: results.length, reason }, "Bulk revoke performed");

    if (results.length > 0) {
      try {
        await this.notificationService.notifyBulkRevoke({
          totalRevoked: results.length,
          reason,
          adminOrUser: adminEmail,
        });
      } catch (notifErr) {
        logger.warn(
          { notifErr },
          "Failed to send admin bulk revoke notification",
        );
      }
    }

    return { revoked: results.length };
  }
}

export default CertificateService;
