import { supabase } from "../../config/supabase";

export class DashboardRepository {
  /**
   * Mengambil data statistik untuk user / organisasi tertentu.
   */
  async getUserStats(userId: string): Promise<{
    totalEvents: number;
    totalCertificates: number;
    activeCertificates: number;
    revokedCertificates: number;
    totalVerifications: number;
  }> {
    // Hitung total acara milik user
    const { count: totalEvents } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // Ambil daftar event_id milik user
    const { data: userEvents } = await supabase
      .from("events")
      .select("id")
      .eq("user_id", userId);

    const eventIds = (userEvents ?? []).map((e: { id: string }) => e.id);

    let totalCertificates = 0;
    let activeCertificates = 0;
    let revokedCertificates = 0;
    let totalVerifications = 0;
    let certIds: string[] = [];

    if (eventIds.length > 0) {
      const [{ count: total }, { count: active }, { count: revoked }] =
        await Promise.all([
          supabase
            .from("certificates")
            .select("id", { count: "exact", head: true })
            .in("event_id", eventIds),
          supabase
            .from("certificates")
            .select("id", { count: "exact", head: true })
            .in("event_id", eventIds)
            .eq("status", "active"),
          supabase
            .from("certificates")
            .select("id", { count: "exact", head: true })
            .in("event_id", eventIds)
            .eq("status", "revoked"),
        ]);

      totalCertificates = total ?? 0;
      activeCertificates = active ?? 0;
      revokedCertificates = revoked ?? 0;

      // Ambil daftar id sertifikat untuk menghitung total verifikasi
      const { data: certs } = await supabase
        .from("certificates")
        .select("id")
        .in("event_id", eventIds);

      certIds = (certs ?? []).map((c: { id: string }) => c.id);
    }

    if (certIds.length > 0) {
      const { count: verifications } = await supabase
        .from("verification_logs")
        .select("id", { count: "exact", head: true })
        .in("certificate_id", certIds);

      totalVerifications = verifications ?? 0;
    }

    return {
      totalEvents: totalEvents ?? 0,
      totalCertificates,
      activeCertificates,
      revokedCertificates,
      totalVerifications,
    };
  }

  /**
   * Tren penerbitan sertifikat user selama N hari terakhir.
   */
  async getCertificateTrend(
    userId: string,
    days = 30,
  ): Promise<{ date: string; count: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: userEvents } = await supabase
      .from("events")
      .select("id")
      .eq("user_id", userId);

    const eventIds = (userEvents ?? []).map((e: { id: string }) => e.id);
    if (eventIds.length === 0) return [];

    const { data } = await supabase
      .from("certificates")
      .select("issued_at")
      .in("event_id", eventIds)
      .gte("issued_at", since.toISOString());

    if (!data) return [];

    const byDate: Record<string, number> = {};
    for (const cert of data as { issued_at: string }[]) {
      const date = cert.issued_at.split("T")[0];
      byDate[date] = (byDate[date] ?? 0) + 1;
    }

    return Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Admin: statistik keseluruhan platform.
   */
  async getAdminStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalEvents: number;
    totalCertificates: number;
    activeCertificates: number;
    revokedCertificates: number;
    totalVerifications: number;
  }> {
    // 1. Ambil data total profil non-admin (mitra/organisasi)
    // Gunakan .neq('role', 'admin') agar mencakup 'user', 'organizer', atau role mitra lainnya
    const [
      usersResult,
      activeUsersResult,
      eventsResult,
      certsResult,
      activeCertsResult,
      revokedCertsResult,
      verificationsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .neq("role", "admin")
        .limit(1),

      supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .neq("role", "admin")
        .eq("status", "active")
        .limit(1),

      supabase
        .from("events")
        .select("id", { count: "exact" })
        .limit(1),

      supabase
        .from("certificates")
        .select("id", { count: "exact" })
        .limit(1),

      supabase
        .from("certificates")
        .select("id", { count: "exact" })
        .eq("status", "active")
        .limit(1),

      supabase
        .from("certificates")
        .select("id", { count: "exact" })
        .eq("status", "revoked")
        .limit(1),

      supabase
        .from("verification_logs")
        .select("id", { count: "exact" })
        .limit(1),
    ]);

    // Fallback: Jika profil non-admin ternyata kosong (misal role di db 'ADMIN' huruf besar),
    // ambil total semua profile dikurangi 1 (admin)
    let totalUsersCount = usersResult.count ?? 0;
    let activeUsersCount = activeUsersResult.count ?? 0;

    if (totalUsersCount === 0) {
      const { count: allProfilesCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .limit(1);

      // Jika ada profil terdaftar, anggap setidaknya 1 adalah akun user jika total > 1
      totalUsersCount = Math.max((allProfilesCount ?? 0) - 1, 0);
      activeUsersCount = totalUsersCount;
    }

    return {
      totalUsers: totalUsersCount,
      activeUsers: activeUsersCount,
      totalEvents: eventsResult.count ?? 0,
      totalCertificates: certsResult.count ?? 0,
      activeCertificates: activeCertsResult.count ?? 0,
      revokedCertificates: revokedCertsResult.count ?? 0,
      totalVerifications: verificationsResult.count ?? 0,
    };
  }
}