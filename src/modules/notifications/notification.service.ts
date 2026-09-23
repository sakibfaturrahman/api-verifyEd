import {
  NotificationRepository,
  CreateNotificationInput,
} from "./notification.repository";

export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  // Kirim notifikasi generik
  async notify(input: CreateNotificationInput): Promise<void> {
    await this.notificationRepository.createNotification(input);
  }

  // Notifikasi admin: pemalsuan file dokumen
  async notifyTamperedDocument(params: {
    certificateNumber: string;
    recipientName?: string;
    ip?: string;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      recipientRole: "admin",
      title: "Indikasi Pemalsuan Dokumen",
      message: `Berkas dengan nomor ${params.certificateNumber} diunggah, namun sidik biner (hash) tidak cocok dengan arsip asli.`,
      type: "tampered_document",
      severity: "high",
      metadata: params,
    });
  }

  // Notifikasi admin: percobaan akses sertifikat dicabut
  async notifyRevokedAccess(params: {
    certificateNumber: string;
    recipientName: string;
    revokeReason?: string;
    ip?: string;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      recipientRole: "admin",
      title: "Percobaan Akses Dokumen Dicabut",
      message: `Sertifikat ${params.certificateNumber} milik ${params.recipientName} yang telah dibatalkan mencoba diperiksa kembali.`,
      type: "revoked_access",
      severity: "high",
      metadata: params,
    });
  }

  // Notifikasi admin: brute force per IP
  async checkAndNotifyRateLimitAbuse(ip: string): Promise<void> {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return;

    const attempts =
      await this.notificationRepository.countRecentVerificationsByIp(ip, 5);
    if (attempts >= 25) {
      await this.notificationRepository.createNotification({
        recipientRole: "admin",
        title: "Aktivitas Verifikasi Mencurigakan",
        message: `Alamat IP ${ip} melakukan ${attempts} kali pengecekan dokumen dalam kurun 5 menit.`,
        type: "suspicious_activity",
        severity: "high",
        metadata: { ip, totalAttempts: attempts },
      });
    }
  }

  // Notifikasi admin: penerbitan massal
  async notifyBulkIssuance(params: {
    eventTitle: string;
    organizerName: string;
    totalCount: number;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      recipientRole: "admin",
      title: "Penerbitan Sertifikat Massal",
      message: `${params.organizerName} menerbitkan ${params.totalCount} sertifikat pada agenda "${params.eventTitle}".`,
      type: "bulk_issuance",
      severity: "medium",
      metadata: params,
    });
  }

  // Notifikasi admin: pencabutan dokumen massal
  async notifyBulkRevoke(params: {
    totalRevoked: number;
    reason: string;
    adminOrUser: string;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      recipientRole: "admin",
      title: "Pencabutan Sertifikat Massal",
      message: `Sebanyak ${params.totalRevoked} sertifikat dicabut serentak oleh ${params.adminOrUser}. Alasan: ${params.reason}`,
      type: "bulk_revoke",
      severity: "medium",
      metadata: params,
    });
  }

  // Notifikasi admin: registrasi pengguna baru
  async notifyNewRegistration(params: {
    name: string;
    email: string;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      recipientRole: "admin",
      title: "Penyelenggara Baru Terdaftar",
      message: `Akun "${params.name}" (${params.email}) telah berhasil mendaftar ke VerifyEd.`,
      type: "new_registration",
      severity: "medium",
      metadata: params,
    });
  }

  // Notifikasi user: selamat datang setelah registrasi
  async notifyUserWelcome(userId: string, userName: string): Promise<void> {
    await this.notificationRepository.createNotification({
      userId,
      recipientRole: "user",
      title: "Selamat Datang di VerifyEd",
      message: `Halo ${userName}, akun Anda telah aktif. Mulai buat agenda acara dan terbitkan sertifikat digital terverifikasi.`,
      type: "welcome",
      severity: "low",
    });
  }

  // Notifikasi user: sertifikat tunggal berhasil terbit
  async notifyUserCertificateIssued(
    userId: string,
    params: {
      certificateNumber: string;
      recipientName: string;
      eventName: string;
    },
  ): Promise<void> {
    await this.notificationRepository.createNotification({
      userId,
      recipientRole: "user",
      title: "Sertifikat Berhasil Diterbitkan",
      message: `Sertifikat ${params.certificateNumber} untuk ${params.recipientName} pada agenda "${params.eventName}" siap digunakan.`,
      type: "certificate_issued",
      severity: "low",
      metadata: params,
    });
  }

  // Notifikasi user: ringkasan unggah massal selesai
  async notifyUserBulkUploadCompleted(
    userId: string,
    params: {
      eventName: string;
      successful: number;
      failed: number;
    },
  ): Promise<void> {
    await this.notificationRepository.createNotification({
      userId,
      recipientRole: "user",
      title: "Penerbitan Massal Selesai",
      message: `Proses batch untuk agenda "${params.eventName}" selesai. Berhasil: ${params.successful}, Gagal: ${params.failed}.`,
      type: "bulk_upload_completed",
      severity: params.failed > 0 ? "medium" : "low",
      metadata: params,
    });
  }

  // Notifikasi user: sertifikat dicabut
  async notifyUserCertificateRevoked(
    userId: string,
    params: {
      certificateNumber: string;
      recipientName: string;
      reason: string;
    },
  ): Promise<void> {
    await this.notificationRepository.createNotification({
      userId,
      recipientRole: "user",
      title: "Sertifikat Dicabut",
      message: `Sertifikat ${params.certificateNumber} milik ${params.recipientName} telah ditandai tidak berlaku. Alasan: ${params.reason}`,
      type: "certificate_revoked",
      severity: "medium",
      metadata: params,
    });
  }

  // Notifikasi user: kegagalan pemrosesan berkas pdf
  async notifyUserProcessingFailed(
    userId: string,
    params: {
      fileName: string;
      error: string;
    },
  ): Promise<void> {
    await this.notificationRepository.createNotification({
      userId,
      recipientRole: "user",
      title: "Gagal Memproses Berkas",
      message: `Berkas "${params.fileName}" gagal diberi stempel verifikasi QR: ${params.error}`,
      type: "processing_failed",
      severity: "high",
      metadata: params,
    });
  }

  // Ambil notifikasi sesuai konteks user login
  async getNotifications(params: {
    userId: string;
    role: "admin" | "user";
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }) {
    return this.notificationRepository.getNotifications(params);
  }

  async markAsRead(
    id: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    await this.notificationRepository.markAsRead(id, userId, isAdmin);
  }

  async markAllAsRead(userId: string, isAdmin: boolean): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId, isAdmin);
  }

  // Deteksi scraping sertifikat banyak penerima dari 1 IP
  async checkAndNotifyMultiRecipientScraping(ip: string): Promise<void> {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return;

    const uniqueCertsCount =
      await this.notificationRepository.countUniqueCertificatesCheckedByIp(
        ip,
        10,
      );

    if (uniqueCertsCount >= 8) {
      await this.notificationRepository.createNotification({
        recipientRole: "admin",
        title: "Aktivitas Mencurigakan: Potensi Scraping Data",
        message: `Alamat IP ${ip} telah memeriksa ${uniqueCertsCount} sertifikat penerima yang berbeda dalam 10 menit terakhir.`,
        type: "suspicious_activity",
        severity: "high",
        metadata: {
          ip,
          uniqueCertificatesChecked: uniqueCertsCount,
          threat: "credential_harvesting",
        },
      });
    }
  }
}
