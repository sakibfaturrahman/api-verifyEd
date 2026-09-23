import { supabase } from "../../config/supabase";
import { logger } from "../../core/utils/logger";

export type NotificationSeverity = "high" | "medium" | "low";
export type NotificationType =
  | "tampered_document"
  | "suspicious_activity"
  | "revoked_access"
  | "bulk_issuance"
  | "bulk_revoke"
  | "new_registration";

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateNotificationInput {
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  metadata?: Record<string, unknown>;
}

export class NotificationRepository {
  // simpan notifikasi baru ke supabase
  async createNotification(input: CreateNotificationInput): Promise<void> {
    const { data, error } = await supabase
      .from("admin_notifications")
      .insert({
        title: input.title,
        message: input.message,
        type: input.type,
        severity: input.severity,
        metadata: input.metadata ?? {},
      })
      .select();

    if (error) {
      // cetak ke terminal console agar langsung terlihat jika ada kesalahan skema atau env
      console.error("supabase insert notification error:", error);
      logger.error({ error }, "failed to write admin notification");
      throw error;
    }

    console.log("notifikasi berhasil disimpan ke db:", data);
  }

  // ambil daftar notifikasi admin
  async getNotifications(opts?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<{
    data: AdminNotification[];
    total: number;
    unreadCount: number;
  }> {
    const page = Math.max(Number(opts?.page) || 1, 1);
    const limit = Math.max(Number(opts?.limit) || 10, 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("admin_notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (opts?.unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      logger.error({ error }, "failed to fetch admin notifications");
      throw error;
    }

    const { count: unreadCount } = await supabase
      .from("admin_notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);

    return {
      data: (data as AdminNotification[]) || [],
      total: count || 0,
      unreadCount: unreadCount || 0,
    };
  }

  // perbarui status baca satu notifikasi
  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      logger.error({ error, id }, "failed to mark notification as read");
      throw error;
    }
  }

  // perbarui status baca seluruh notifikasi
  async markAllAsRead(): Promise<void> {
    const { error } = await supabase
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    if (error) {
      logger.error({ error }, "failed to mark all notifications as read");
      throw error;
    }
  }

  // hitung percobaan verifikasi dari ip dalam kurun menit tertentu
  async countRecentVerificationsByIp(
    ip: string,
    minutes: number = 5,
  ): Promise<number> {
    const timeThreshold = new Date(
      Date.now() - minutes * 60 * 1000,
    ).toISOString();

    const { count, error } = await supabase
      .from("verification_logs")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", timeThreshold);

    if (error) {
      logger.error({ error, ip }, "failed to check recent ip verifications");
      return 0;
    }

    return count || 0;
  }
}
