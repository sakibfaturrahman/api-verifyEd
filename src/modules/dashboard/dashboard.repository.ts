import { supabase } from '../../config/supabase';

export class DashboardRepository {
  /**
   * Gets statistics for a specific user's events and certificates.
   */
  async getUserStats(userId: string): Promise<{
    totalEvents: number;
    totalCertificates: number;
    activeCertificates: number;
    revokedCertificates: number;
    totalVerifications: number;
  }> {
    // Events count
    const { count: totalEvents } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get event IDs for the user
    const { data: userEvents } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId);

    const eventIds = (userEvents ?? []).map((e: { id: string }) => e.id);

    let totalCertificates = 0;
    let activeCertificates = 0;
    let revokedCertificates = 0;
    let totalVerifications = 0;
    let certIds: string[] = [];

    if (eventIds.length > 0) {
      const { count: total } = await supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds);

      const { count: active } = await supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .eq('status', 'active');

      const { count: revoked } = await supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .eq('status', 'revoked');

      totalCertificates = total ?? 0;
      activeCertificates = active ?? 0;
      revokedCertificates = revoked ?? 0;

      // Get certificate IDs for verification count
      const { data: certs } = await supabase
        .from('certificates')
        .select('id')
        .in('event_id', eventIds);
      certIds = (certs ?? []).map((c: { id: string }) => c.id);
    }

    if (certIds.length > 0) {
      const { count: verifications } = await supabase
        .from('verification_logs')
        .select('id', { count: 'exact', head: true })
        .in('certificate_id', certIds);
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
   * Gets certificate issuance trend over past N days.
   */
  async getCertificateTrend(userId: string, days = 30): Promise<{ date: string; count: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: userEvents } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId);

    const eventIds = (userEvents ?? []).map((e: { id: string }) => e.id);
    if (eventIds.length === 0) return [];

    const { data } = await supabase
      .from('certificates')
      .select('issued_at')
      .in('event_id', eventIds)
      .gte('issued_at', since.toISOString());

    if (!data) return [];

    // Group by date
    const byDate: Record<string, number> = {};
    for (const cert of data as { issued_at: string }[]) {
      const date = cert.issued_at.split('T')[0];
      byDate[date] = (byDate[date] ?? 0) + 1;
    }

    return Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Admin: global platform statistics.
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
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: totalEvents },
      { count: totalCertificates },
      { count: activeCertificates },
      { count: revokedCertificates },
      { count: totalVerifications },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('certificates').select('id', { count: 'exact', head: true }),
      supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('status', 'revoked'),
      supabase.from('verification_logs').select('id', { count: 'exact', head: true }),
    ]);

    return {
      totalUsers: totalUsers ?? 0,
      activeUsers: activeUsers ?? 0,
      totalEvents: totalEvents ?? 0,
      totalCertificates: totalCertificates ?? 0,
      activeCertificates: activeCertificates ?? 0,
      revokedCertificates: revokedCertificates ?? 0,
      totalVerifications: totalVerifications ?? 0,
    };
  }
}
