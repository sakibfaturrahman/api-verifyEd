import {
  NotificationRepository,
  CreateNotificationInput,
  AdminNotification,
} from "./notification.repository";

export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  // kirim notifikasi umum
  async notify(input: CreateNotificationInput): Promise<void> {
    await this.notificationRepository.createNotification(input);
  }

  // notifikasi: dokumen diedit atau dipalsukan
  async notifyTamperedDocument(params: {
    certificateNumber: string;
    recipientName?: string;
    ip?: string;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      title: "Indikasi Pemalsuan Dokumen",
      message: `Berkas dengan nomor ${params.certificateNumber} diunggah, namun sidik biner (hash) tidak cocok dengan arsip asli.`,
      type: "tampered_document",
      severity: "high",
      metadata: {
        certificateNumber: params.certificateNumber,
        recipientName: params.recipientName,
        ip: params.ip,
      },
    });
  }

  // notifikasi: akses ke sertifikat yang sudah dicabut
  async notifyRevokedAccess(params: {
    certificateNumber: string;
    recipientName: string;
    revokeReason?: string;
    ip?: string;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      title: "Percobaan Akses Dokumen Dicabut",
      message: `Sertifikat ${params.certificateNumber} milik ${params.recipientName} yang telah dibatalkan mencoba diperiksa kembali oleh publik.`,
      type: "revoked_access",
      severity: "high",
      metadata: {
        certificateNumber: params.certificateNumber,
        recipientName: params.recipientName,
        revokeReason: params.revokeReason,
        ip: params.ip,
      },
    });
  }

  // periksa dan picu notifikasi percobaan massal dari 1 alamat ip
  async checkAndNotifyRateLimitAbuse(ip: string): Promise<void> {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return;

    // hitung apakah ip melakukan lebih dari 25 kali percobaan dalam 5 menit
    const attempts =
      await this.notificationRepository.countRecentVerificationsByIp(ip, 5);

    if (attempts >= 25) {
      await this.notificationRepository.createNotification({
        title: "Aktivitas Verifikasi Mencurigakan",
        message: `Alamat IP ${ip} telah melakukan ${attempts} kali pemeriksaan dokumen dalam 5 menit terakhir.`,
        type: "suspicious_activity",
        severity: "high",
        metadata: { ip, totalAttempts: attempts },
      });
    }
  }

  // notifikasi: penerbitan sertifikat skala besar
  async notifyBulkIssuance(params: {
    eventTitle: string;
    organizerName: string;
    totalCount: number;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      title: "Penerbitan Sertifikat Massal",
      message: `${params.organizerName} baru saja menerbitkan ${params.totalCount} sertifikat untuk agenda "${params.eventTitle}".`,
      type: "bulk_issuance",
      severity: "medium",
      metadata: params,
    });
  }

  // notifikasi: pencabutan dokumen massal
  async notifyBulkRevoke(params: {
    totalRevoked: number;
    reason: string;
    adminOrUser: string;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      title: "Pencabutan Sertifikat Massal",
      message: `Sebanyak ${params.totalRevoked} dokumen telah dicabut serentak oleh ${params.adminOrUser}. Alasan: ${params.reason}`,
      type: "bulk_revoke",
      severity: "medium",
      metadata: params,
    });
  }

  // notifikasi: registrasi penyelenggara baru
  async notifyNewRegistration(params: {
    name: string;
    email: string;
  }): Promise<void> {
    await this.notificationRepository.createNotification({
      title: "Penyelenggara Baru Terdaftar",
      message: `Instansi atau organisasi "${params.name}" (${params.email}) telah mendaftar ke VerifyEd.`,
      type: "new_registration",
      severity: "medium",
      metadata: params,
    });
  }

  // ambil daftar notifikasi
  async getAdminNotifications(query: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }) {
    return this.notificationRepository.getNotifications(query);
  }

  // ubah status baca
  async markNotificationAsRead(id: string): Promise<void> {
    await this.notificationRepository.markAsRead(id);
  }

  // tandai semua telah dibaca
  async markAllNotificationsAsRead(): Promise<void> {
    await this.notificationRepository.markAllAsRead();
  }
}
