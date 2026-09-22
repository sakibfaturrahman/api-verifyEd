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
  // simpan notifikasi baru ke database
  async createNotification(input: CreateNotificationInput): Promise<void> {
    const { error } = await supabase.from("admin_notifications").insert({
      title: input.title,
      message: input.message,
      type: input.type,
      severity: input.severity,
      metadata: input.metadata ?? {},
    });

    if (error) {
      // catat log error tanpa menghentikan alur proses utama
      logger.error({ error }, "failed to write admin notification");
    }
  }

  // ambil daftar notifikasi dengan paginasi dan filter
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

    // hitung total belum dibaca
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

  // tandai satu notifikasi telah dibaca
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

  // tandai semua notifikasi telah dibaca
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

  // periksa jumlah upaya verifikasi dari ip tertentu dalam kurun waktu menit
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
