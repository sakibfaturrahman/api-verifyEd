import { CertificateRepository, CertificateRow, CertificateWithEvent } from './certificate.repository';
import { EventService } from '../events/event.service';
import { RevokeCertificateDto, QrConfigDto, QrConfig, ListCertificatesQuery } from './certificate.validation';
import { embedQrCodeInPdf } from './certificate.generator';
import { sha256 } from '../../core/utils/hash';
import { generateSecureToken, generateCertificateNumber } from '../../core/utils/token';
import { buildStoragePath, validatePdfFile } from '../../core/utils/file';
import { parsePagination, buildPaginationMeta } from '../../core/utils/pagination';
import { NotFoundError } from '../../core/errors/NotFoundError';
import { ForbiddenError } from '../../core/errors/ForbiddenError';
import { AppError } from '../../core/errors/AppError';
import { env } from '../../config/env';
import { logger } from '../../app';

// Plain DTO used in service (qr_config already parsed by controller)
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
  status: 'success' | 'failed';
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
  ) {}

  /**
   * Full certificate upload + generation flow:
   * 1. Validate PDF
   * 2. Assert event ownership
   * 3. Calculate SHA-256 hash
   * 4. Create DB record
   * 5. Upload original PDF to Storage
   * 6. Generate QR-embedded PDF
   * 7. Upload generated PDF to Storage
   * 8. Update DB with file paths and hash
   *
   * Compensating cleanup: if steps 5-8 fail, the DB record is marked for cleanup.
   * Storage and DB are not in the same ACID transaction — this is documented.
   */
  async uploadCertificate(
    userId: string,
    dto: UploadCertificateDto,
    file: Express.Multer.File,
    verifyBaseUrl: string,
  ): Promise<SingleUploadResult> {
    // 1. Validate PDF
    const validation = validatePdfFile(file.originalname, file.mimetype, file.buffer, env.MAX_FILE_SIZE);
    if (!validation.valid) {
      throw new AppError(validation.error!, 400, 'INVALID_FILE');
    }

    // 2. Assert event ownership
    await this.eventService.assertEventOwnership(dto.event_id, userId);

    // 3. Calculate SHA-256
    const fileHash = sha256(file.buffer);

    // 4. Generate tokens
    const certificateNumber = generateCertificateNumber();
    const qrToken = generateSecureToken(32); // 64-char hex

    // 5. Create DB record first (get the certificate ID)
    const certificate = await this.certRepository.create({
      event_id: dto.event_id,
      certificate_number: certificateNumber,
      recipient_name: dto.recipient_name,
      qr_token: qrToken,
      qr_config: dto.qr_config as QrConfig | undefined,
    });

    const originalPath = buildStoragePath(userId, dto.event_id, certificate.id, 'original');
    const generatedPath = buildStoragePath(userId, dto.event_id, certificate.id, 'generated');

    try {
      // 6. Upload original PDF
      await this.certRepository.uploadFile(
        env.SUPABASE_STORAGE_BUCKET_ORIGINAL,
        originalPath,
        file.buffer,
        'application/pdf',
      );

      // 7. Generate QR-embedded PDF
      const { generatedPdfBuffer, appliedConfig } = await embedQrCodeInPdf({
        pdfBuffer: file.buffer,
        certificateNumber,
        qrToken,
        verifyBaseUrl,
        qrConfig: dto.qr_config as QrConfig | undefined,
      });

      // 8. Upload generated PDF
      await this.certRepository.uploadFile(
        env.SUPABASE_STORAGE_BUCKET_GENERATED,
        generatedPath,
        generatedPdfBuffer,
        'application/pdf',
      );

      // 9. Update DB with file paths, hash, and applied QR config
      await this.certRepository.updateFileInfo(certificate.id, {
        original_file: originalPath,
        generated_file: generatedPath,
        file_hash: fileHash,
        qr_config: appliedConfig,
      });

      logger.info({ certificateId: certificate.id, certificateNumber }, 'Certificate uploaded and generated');

      // Return with event join
      const full = await this.certRepository.findById(certificate.id);
      return { certificate: full! };
    } catch (err) {
      // Compensating cleanup — remove any files already uploaded
      logger.error({ certificateId: certificate.id, err }, 'Certificate upload failed, cleaning up');
      await this.certRepository.deleteFile(env.SUPABASE_STORAGE_BUCKET_ORIGINAL, originalPath).catch(() => {});
      await this.certRepository.deleteFile(env.SUPABASE_STORAGE_BUCKET_GENERATED, generatedPath).catch(() => {});
      // Remove the DB record (it has no file links — useless)
      // Note: No cascade delete available here; we delete directly
      const { supabase } = await import('../../config/supabase');
      await supabase.from('certificates').delete().eq('id', certificate.id);
      throw err;
    }
  }

  /**
   * Bulk upload — processes each file independently.
   * One failure does NOT stop other files.
   */
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
      const recipientName = recipientNames[i] ?? file.originalname.replace('.pdf', '');

      try {
        await this.uploadCertificate(
          userId,
          { event_id: eventId, recipient_name: recipientName, qr_config: undefined },
          file,
          verifyBaseUrl,
        );

        // Retrieve the created certificate number
        const created = await this.certRepository.findAll({
          userId,
          page: 1,
          limit: 1,
          offset: 0,
          eventId,
        });

        results.push({
          file: file.originalname,
          status: 'success',
          certificateNumber: created.data[0]?.certificate_number,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ file: file.originalname, status: 'failed', error: message });
      }
    }

    return {
      total: files.length,
      successful: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

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

  async getCertificateById(id: string, userId: string, isAdmin = false): Promise<CertificateWithEvent> {
    const cert = await this.certRepository.findById(id);
    if (!cert) throw new NotFoundError('Certificate');

    if (!isAdmin && cert.events.user_id !== userId) {
      throw new ForbiddenError('You do not have access to this certificate');
    }

    return cert;
  }

  async downloadCertificate(id: string, userId: string, isAdmin = false): Promise<string> {
    const cert = await this.getCertificateById(id, userId, isAdmin);

    const filePath = cert.generated_file ?? cert.original_file;
    if (!filePath) {
      throw new AppError('No file available for this certificate', 404, 'FILE_NOT_FOUND');
    }

    const bucket = cert.generated_file
      ? env.SUPABASE_STORAGE_BUCKET_GENERATED
      : env.SUPABASE_STORAGE_BUCKET_ORIGINAL;

    return this.certRepository.getSignedUrl(filePath, bucket, env.SIGNED_URL_EXPIRY);
  }

  async revokeCertificate(
    id: string,
    userId: string,
    dto: RevokeCertificateDto,
    isAdmin = false,
  ): Promise<CertificateRow> {
    const cert = await this.getCertificateById(id, userId, isAdmin);

    if (cert.status === 'revoked') {
      throw new AppError('Certificate is already revoked', 409, 'ALREADY_REVOKED');
    }

    logger.info({ certificateId: id, userId }, 'Certificate revoked');
    return this.certRepository.revoke(id, dto.reason);
  }

  /**
   * Regenerate Certificate — MVP behavior (documented):
   * - Certificate ID (certificate_number) is PRESERVED
   * - QR token is PRESERVED
   * - New PDF is generated with the same QR config
   * - New SHA-256 hash is calculated from the new original
   * - Old generated file is deleted from Storage
   *
   * Rationale: Preserving certificate_number and qr_token maintains
   * existing links (printed QR codes, shared URLs). The new hash reflects
   * the corrected document. This is the safest MVP approach.
   */
  async regenerateCertificate(
    id: string,
    userId: string,
    file: Express.Multer.File,
    verifyBaseUrl: string,
  ): Promise<CertificateWithEvent> {
    const cert = await this.getCertificateById(id, userId);

    const validation = validatePdfFile(file.originalname, file.mimetype, file.buffer, env.MAX_FILE_SIZE);
    if (!validation.valid) {
      throw new AppError(validation.error!, 400, 'INVALID_FILE');
    }

    const fileHash = sha256(file.buffer);
    const originalPath = buildStoragePath(userId, cert.event_id, cert.id, 'original');
    const generatedPath = buildStoragePath(userId, cert.event_id, cert.id, 'generated');

    // Delete old generated PDF before uploading new one
    if (cert.generated_file) {
      await this.certRepository.deleteFile(env.SUPABASE_STORAGE_BUCKET_GENERATED, generatedPath).catch(() => {});
    }

    // Upload new original
    await this.certRepository.uploadFile(
      env.SUPABASE_STORAGE_BUCKET_ORIGINAL,
      originalPath,
      file.buffer,
      'application/pdf',
    );

    // Generate new QR-embedded PDF using existing config
    const { generatedPdfBuffer, appliedConfig } = await embedQrCodeInPdf({
      pdfBuffer: file.buffer,
      certificateNumber: cert.certificate_number,
      qrToken: cert.qr_token,
      verifyBaseUrl,
      qrConfig: cert.qr_config ?? undefined,
    });

    await this.certRepository.uploadFile(
      env.SUPABASE_STORAGE_BUCKET_GENERATED,
      generatedPath,
      generatedPdfBuffer,
      'application/pdf',
    );

    await this.certRepository.updateFileInfo(cert.id, {
      original_file: originalPath,
      generated_file: generatedPath,
      file_hash: fileHash,
      qr_config: appliedConfig,
    });

    logger.info({ certificateId: id }, 'Certificate regenerated');

    return (await this.certRepository.findById(id))!;
  }

  async saveQrConfig(certificateId: string, userId: string, config: QrConfigDto): Promise<CertificateRow> {
    const cert = await this.certRepository.findById(certificateId);
    if (!cert) throw new NotFoundError('Certificate');
    if (cert.events.user_id !== userId) throw new ForbiddenError('Not your certificate');

    return this.certRepository.updateQrConfig(certificateId, {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      page: config.page,
      rotation: config.rotation,
    });
  }

  // Admin operations
  async listAllCertificates(query: ListCertificatesQuery) {
    const { page, limit, offset } = parsePagination(query.page, query.limit);
    const { data, total } = await this.certRepository.findAll({
      page, limit, offset,
      search: query.search,
      status: query.status,
      eventId: query.event_id,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async bulkRevoke(ids: string[], reason: string): Promise<{ revoked: number }> {
    const results = await this.certRepository.bulkRevoke(ids, reason);
    logger.info({ count: results.length, reason }, 'Bulk revoke performed');
    return { revoked: results.length };
  }
}
