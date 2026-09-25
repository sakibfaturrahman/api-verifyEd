import { DashboardRepository } from "./dashboard.repository";
import { VerificationRepository } from "../verification/verification.repository";

export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly verificationRepository: VerificationRepository,
  ) {}

  /**
   * Mengambil ringkasan statistik dan tren penerbitan sertifikat untuk dasbor pengguna/organisasi.
   */
  async getUserDashboard(userId: string) {
    const [stats, certificateTrend] = await Promise.all([
      this.dashboardRepository.getUserStats(userId),
      this.dashboardRepository.getCertificateTrend(userId, 30),
    ]);

    return {
      stats,
      charts: {
        certificateIssuanceTrend: certificateTrend,
      },
    };
  }

  /**
   * Mengambil statistik platform secara menyeluruh untuk dasbor admin.
   */
  async getAdminDashboard() {
    const [stats, verificationStats] = await Promise.all([
      this.dashboardRepository.getAdminStats(),
      this.verificationRepository.getStats(),
    ]);

    return {
      stats,
      verificationStats,
    };
  }
}

export default DashboardService;
