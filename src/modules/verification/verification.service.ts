import { CertificateRepository, CertificateWithEvent } from '../certificates/certificate.repository';
import { VerificationRepository } from './verification.repository';
import { sha256, compareHashes } from '../../core/utils/hash';
import { validatePdfFile } from '../../core/utils/file';
import { env } from '../../config/env';
import { AppError } from '../../core/errors/AppError';

export type VerificationStatus = 'verified' | 'revoked' | 'not_found';

export interface VerificationResult {
  status: VerificationStatus;
  certificate?: {
    certificateNumber: string;
    recipientName: string;
    event: string;
    organization: string;
    issuedAt: string;
    documentIntegrity: 'valid' | 'invalid' | 'not_checked';
    revokedAt?: string;
    revokeReason?: string;
  };
}

/**
 * Formats a certificate into the public-safe verification response.
 * Does NOT expose internal IDs, file paths, or QR tokens.
 */
function formatPublicCertificate(
  cert: CertificateWithEvent,
  documentIntegrity: 'valid' | 'invalid' | 'not_checked',
): VerificationResult['certificate'] {
  return {
    certificateNumber: cert.certificate_number,
    recipientName: cert.recipient_name,
    event: cert.events.name,
    organization: cert.events.organizer,
    issuedAt: cert.issued_at,
    documentIntegrity,
    revokedAt: cert.revoked_at ?? undefined,
    revokeReason: cert.revoke_reason ?? undefined,
  };
}

export class VerificationService {
  constructor(
    private readonly certRepository: CertificateRepository,
    private readonly verificationRepository: VerificationRepository,
  ) {}

  /**
   * Verify by Certificate Number.
   *
   * Flow:
   * 1. Find certificate by number
   * 2. Not found → log not_found, return not_found
   * 3. Found + active → log verified, return verified
   * 4. Found + revoked → log revoked, return revoked
   */
  async verifyByCertificateNumber(
    certificateNumber: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<VerificationResult> {
    const cert = await this.certRepository.findByNumber(certificateNumber);

    if (!cert) {
      await this.verificationRepository.createLog({
        method: 'certificate_id',
        result: 'not_found',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });
      return { status: 'not_found' };
    }

    const result: VerificationStatus = cert.status === 'active' ? 'verified' : 'revoked';

    await this.verificationRepository.createLog({
      certificate_id: cert.id,
      method: 'certificate_id',
      result,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    });

    return {
      status: result,
      certificate: formatPublicCertificate(cert, 'not_checked'),
    };
  }

  /**
   * Verify by QR Token.
   *
   * Flow:
   * 1. Find certificate by qr_token
   * 2. Not found → log not_found
   * 3. Found + active → verified
   * 4. Found + revoked → revoked
   */
  async verifyByQrToken(
    qrToken: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<VerificationResult> {
    const cert = await this.certRepository.findByQrToken(qrToken);

    if (!cert) {
      await this.verificationRepository.createLog({
        method: 'qr',
        result: 'not_found',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });
      return { status: 'not_found' };
    }

    const result: VerificationStatus = cert.status === 'active' ? 'verified' : 'revoked';

    await this.verificationRepository.createLog({
      certificate_id: cert.id,
      method: 'qr',
      result,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    });

    return {
      status: result,
      certificate: formatPublicCertificate(cert, 'not_checked'),
    };
  }

  /**
   * Verify by PDF Upload (most important verification method).
   *
   * Flow:
   * 1. Validate that uploaded file is a PDF
   * 2. Calculate SHA-256 of uploaded file
   * 3. Find certificate by hash
   * 4. No match → not_found (hash doesn't match ANY certificate)
   * 5. Match found:
   *    a. Compare hashes using timing-safe comparison
   *    b. active + hash match → verified + integrity: valid
   *    c. revoked + hash match → revoked + integrity: valid
   *
   * CRITICAL: A matching hash confirms the document has NOT been tampered with.
   * If a certificate_number exists in the PDF metadata but the hash differs,
   * the correct response is integrity: invalid — NOT verified.
   */
  async verifyByPdf(
    file: Express.Multer.File,
    meta: { ip?: string; userAgent?: string },
  ): Promise<VerificationResult> {
    // Validate PDF
    const validation = validatePdfFile(file.originalname, file.mimetype, file.buffer, env.MAX_FILE_SIZE);
    if (!validation.valid) {
      throw new AppError(validation.error!, 400, 'INVALID_FILE');
    }

    // Calculate hash of uploaded file
    const uploadedHash = sha256(file.buffer);

    // Look up certificate by hash
    const cert = await this.certRepository.findByHash(uploadedHash);

    if (!cert) {
      // No certificate matches this hash — either not_found or tampered document
      await this.verificationRepository.createLog({
        method: 'pdf',
        result: 'not_found',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });

      return {
        status: 'not_found',
        // Explicitly indicate integrity is invalid when hash doesn't match
        certificate: {
          certificateNumber: 'unknown',
          recipientName: 'unknown',
          event: 'unknown',
          organization: 'unknown',
          issuedAt: new Date().toISOString(),
          documentIntegrity: 'invalid',
        },
      };
    }

    // Double-check with timing-safe comparison
    const hashMatch = compareHashes(uploadedHash, cert.file_hash ?? '');

    if (!hashMatch) {
      // This should not happen (findByHash matched), but defend against edge cases
      await this.verificationRepository.createLog({
        certificate_id: cert.id,
        method: 'pdf',
        result: 'not_found',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });
      return { status: 'not_found', certificate: formatPublicCertificate(cert, 'invalid') };
    }

    const result: VerificationStatus = cert.status === 'active' ? 'verified' : 'revoked';

    await this.verificationRepository.createLog({
      certificate_id: cert.id,
      method: 'pdf',
      result,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    });

    return {
      status: result,
      certificate: formatPublicCertificate(cert, 'valid'),
    };
  }
}
