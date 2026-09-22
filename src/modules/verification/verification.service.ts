import { PDFDocument } from "pdf-lib";
import {
  CertificateRepository,
  CertificateWithEvent,
} from "../certificates/certificate.repository";
import { VerificationRepository } from "./verification.repository";
import { sha256, compareHashes } from "../../core/utils/hash";
import { validatePdfFile } from "../../core/utils/file";
import { env } from "../../config/env";
import { AppError } from "../../core/errors/AppError";

export type VerificationStatus = "verified" | "revoked" | "not_found";

export interface VerificationResult {
  status: VerificationStatus;
  certificate?: {
    certificateNumber: string;
    recipientName: string;
    event: string;
    organization: string;
    issuedAt: string;
    documentIntegrity: "valid" | "invalid" | "not_checked";
    revokedAt?: string;
    revokeReason?: string;
  };
}

/**
 * Format data sertifikat publik yang aman tanpa mengekspos ID internal atau path berkas.
 */
function formatPublicCertificate(
  cert: CertificateWithEvent,
  documentIntegrity: "valid" | "invalid" | "not_checked",
): VerificationResult["certificate"] {
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

  async verifyByCertificateNumber(
    certificateNumber: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<VerificationResult> {
    const cert = await this.certRepository.findByNumber(certificateNumber);

    if (!cert) {
      await this.verificationRepository.createLog({
        method: "certificate_id",
        result: "not_found",
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });
      return { status: "not_found" };
    }

    const result: VerificationStatus =
      cert.status === "active" ? "verified" : "revoked";

    await this.verificationRepository.createLog({
      certificate_id: cert.id,
      method: "certificate_id",
      result,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    });

    return {
      status: result,
      certificate: formatPublicCertificate(cert, "not_checked"),
    };
  }

  async verifyByQrToken(
    qrToken: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<VerificationResult> {
    const cert = await this.certRepository.findByQrToken(qrToken);

    if (!cert) {
      await this.verificationRepository.createLog({
        method: "qr",
        result: "not_found",
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });
      return { status: "not_found" };
    }

    const result: VerificationStatus =
      cert.status === "active" ? "verified" : "revoked";

    await this.verificationRepository.createLog({
      certificate_id: cert.id,
      method: "qr",
      result,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    });

    return {
      status: result,
      certificate: formatPublicCertificate(cert, "not_checked"),
    };
  }

  async verifyByPdf(
    file: Express.Multer.File,
    meta: { ip?: string; userAgent?: string },
  ): Promise<VerificationResult> {
    const validation = validatePdfFile(
      file.originalname,
      file.mimetype,
      file.buffer,
      env.MAX_FILE_SIZE,
    );
    if (!validation.valid) {
      throw new AppError(validation.error!, 400, "INVALID_FILE");
    }

    const uploadedHash = sha256(file.buffer);
    let cert = await this.certRepository.findByHash(uploadedHash);

    if (!cert) {
      try {
        const pdfDoc = await PDFDocument.load(file.buffer, {
          ignoreEncryption: true,
        });
        const title = pdfDoc.getTitle();

        if (title && title.includes("Certificate: ")) {
          const certNumber = title.replace("Certificate: ", "").trim();
          const foundByNumber =
            await this.certRepository.findByNumber(certNumber);

          if (foundByNumber) {
            await this.verificationRepository.createLog({
              certificate_id: foundByNumber.id,
              method: "pdf",
              result: "not_found",
              ip_address: meta.ip,
              user_agent: meta.userAgent,
            });

            return {
              status: "not_found",
              certificate: formatPublicCertificate(foundByNumber, "invalid"),
            };
          }
        }
      } catch {
        // Abaikan jika berkas tidak memiliki info metadata valid
      }

      await this.verificationRepository.createLog({
        method: "pdf",
        result: "not_found",
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });

      return { status: "not_found" };
    }

    const hashMatch = compareHashes(uploadedHash, cert.file_hash ?? "");
    if (!hashMatch) {
      await this.verificationRepository.createLog({
        certificate_id: cert.id,
        method: "pdf",
        result: "not_found",
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });
      return {
        status: "not_found",
        certificate: formatPublicCertificate(cert, "invalid"),
      };
    }

    const result: VerificationStatus =
      cert.status === "active" ? "verified" : "revoked";

    await this.verificationRepository.createLog({
      certificate_id: cert.id,
      method: "pdf",
      result,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    });

    return {
      status: result,
      certificate: formatPublicCertificate(cert, "valid"),
    };
  }

  async getVerificationLogs(query: { page?: number; limit?: number }) {
    return this.verificationRepository.getLogs(query);
  }
}
