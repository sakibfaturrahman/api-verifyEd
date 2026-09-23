import { supabase } from "../../config/supabase";
import { logger } from "../../app";

export type NotificationSeverity = "high" | "medium" | "low";
export type NotificationRecipientRole = "admin" | "user" | "all";

export type NotificationType =
  | "tampered_document"
  | "suspicious_activity"
  | "revoked_access"
  | "bulk_issuance"
  | "bulk_revoke"
  | "new_registration"
  | "welcome"
  | "certificate_issued"
  | "bulk_upload_completed"
  | "certificate_revoked"
  | "processing_failed";

export interface AppNotification {
  id: string;
  user_id: string | null;
  recipient_role: NotificationRecipientRole;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateNotificationInput {
  userId?: string | null;
  recipientRole?: NotificationRecipientRole;
  title: string;
  message: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  metadata?: Record<string, unknown>;
}

export class NotificationRepository {
  // simpan notifikasi baru
  async createNotification(input: CreateNotificationInput): Promise<void> {
    const { error } = await supabase.from("notifications").insert({
      user_id: input.userId ?? null,
      recipient_role: input.recipientRole ?? (input.userId ? "user" : "admin"),
      title: input.title,
      message: input.message,
      type: input.type,
      severity: input.severity ?? "medium",
      metadata: input.metadata ?? {},
    });

    if (error) {
      logger.error({ error }, "failed to insert notification");
      throw error;
    }
  }

  // ambil daftar notifikasi dengan guard role dan user id
  async getNotifications(params: {
    userId: string;
    role: "admin" | "user";
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<{ data: AppNotification[]; total: number; unreadCount: number }> {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.max(Number(params.limit) || 10, 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // guard: admin melihat notifikasi admin atau global, user hanya melihat miliknya
    if (params.role === "admin") {
      query = query.or("recipient_role.eq.admin,recipient_role.eq.all");
    } else {
      query = query.eq("user_id", params.userId);
    }

    if (params.unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      logger.error({ error }, "failed to fetch notifications");
      throw error;
    }

    // hitung total unread berdasarkan guard role
    let unreadQuery = supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);

    if (params.role === "admin") {
      unreadQuery = unreadQuery.or(
        "recipient_role.eq.admin,recipient_role.eq.all",
      );
    } else {
      unreadQuery = unreadQuery.eq("user_id", params.userId);
    }

    const { count: unreadCount } = await unreadQuery;

    return {
      data: (data as AppNotification[]) || [],
      total: count || 0,
      unreadCount: unreadCount || 0,
    };
  }

  // tandai satu notifikasi telah dibaca dengan verifikasi hak milik
  async markAsRead(
    id: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    let query = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    // jika bukan admin pastikan notifikasi milik user bersangkutan
    if (!isAdmin) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;
    if (error) {
      logger.error({ error, id }, "failed to mark notification as read");
      throw error;
    }
  }

  // tandai semua notifikasi telah dibaca sesuai guard role
  async markAllAsRead(userId: string, isAdmin: boolean): Promise<void> {
    let query = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    if (isAdmin) {
      query = query.or("recipient_role.eq.admin,recipient_role.eq.all");
    } else {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;
    if (error) {
      logger.error({ error }, "failed to mark all notifications as read");
      throw error;
    }
  }

  // periksa frekuensi upaya verifikasi dari ip
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

    if (error) return 0;
    return count || 0;
  }
}
