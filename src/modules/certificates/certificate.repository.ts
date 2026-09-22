import { logger } from "../../core/utils/logger";
import { supabase } from "../../config/supabase";
import { QrConfig } from "./certificate.validation";

export interface CertificateRow {
  id: string;
  event_id: string;
  certificate_number: string;
  recipient_name: string;
  original_file: string | null;
  generated_file: string | null;
  file_hash: string | null;
  qr_token: string;
  qr_config: QrConfig | null;
  status: "active" | "revoked";
  issued_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertificateWithEvent extends CertificateRow {
  events: {
    id: string;
    name: string;
    organizer: string;
    event_date: string;
    user_id: string;
  };
}

export class CertificateRepository {
  async create(data: {
    event_id: string;
    certificate_number: string;
    recipient_name: string;
    qr_token: string;
    qr_config?: QrConfig;
  }): Promise<CertificateRow> {
    const { data: row, error } = await supabase
      .from("certificates")
      .insert(data)
      .select("*")
      .single();

    if (error) throw error;
    return row as CertificateRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("certificates").delete().eq("id", id);

    if (error) {
      logger.error({ error, id }, "failed to delete certificate from database");
      throw error;
    }
  }

  async updateFileInfo(
    id: string,
    updates: {
      original_file?: string;
      generated_file?: string;
      file_hash?: string;
      qr_config?: QrConfig;
    },
  ): Promise<CertificateRow> {
    const { data, error } = await supabase
      .from("certificates")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as CertificateRow;
  }

  async findById(id: string): Promise<CertificateWithEvent | null> {
    const { data, error } = await supabase
      .from("certificates")
      .select("*, events(id, name, organizer, event_date, user_id)")
      .eq("id", id)
      .single();

    if (error) return null;
    return data as CertificateWithEvent;
  }

  async findByNumber(
    certificateNumber: string,
  ): Promise<CertificateWithEvent | null> {
    const { data, error } = await supabase
      .from("certificates")
      .select("*, events(id, name, organizer, event_date, user_id)")
      .eq("certificate_number", certificateNumber)
      .single();

    if (error) return null;
    return data as CertificateWithEvent;
  }

  async findByQrToken(qrToken: string): Promise<CertificateWithEvent | null> {
    const { data, error } = await supabase
      .from("certificates")
      .select("*, events(id, name, organizer, event_date, user_id)")
      .eq("qr_token", qrToken)
      .single();

    if (error) return null;
    return data as CertificateWithEvent;
  }

  async findByHash(fileHash: string): Promise<CertificateWithEvent | null> {
    const { data, error } = await supabase
      .from("certificates")
      .select("*, events(id, name, organizer, event_date, user_id)")
      .eq("file_hash", fileHash)
      .single();

    if (error) return null;
    return data as CertificateWithEvent;
  }

  async findAll(opts: {
    userId?: string; // If set, only returns certificates from this user's events
    page: number;
    limit: number;
    offset: number;
    search?: string;
    status?: string;
    eventId?: string;
  }): Promise<{ data: CertificateWithEvent[]; total: number }> {
    let query = supabase
      .from("certificates")
      .select("*, events!inner(id, name, organizer, event_date, user_id)", {
        count: "exact",
      });

    // Ownership filter
    if (opts.userId) {
      query = query.eq("events.user_id", opts.userId);
    }

    if (opts.eventId) {
      query = query.eq("event_id", opts.eventId);
    }

    if (opts.status) {
      query = query.eq("status", opts.status);
    }

    if (opts.search) {
      query = query.ilike("recipient_name", `%${opts.search}%`);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);

    if (error) throw error;
    return { data: (data as CertificateWithEvent[]) ?? [], total: count ?? 0 };
  }

  async revoke(id: string, reason: string): Promise<CertificateRow> {
    const { data, error } = await supabase
      .from("certificates")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as CertificateRow;
  }

  async bulkRevoke(
    ids: string[],
    reason: string,
  ): Promise<{ id: string; status: string }[]> {
    const { data, error } = await supabase
      .from("certificates")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .select("id, status");

    if (error) throw error;
    return (data ?? []) as { id: string; status: string }[];
  }

  async getSignedUrl(
    storagePath: string,
    bucket: string,
    expiresIn: number,
  ): Promise<string> {
    const cleanPath = storagePath
      .replace(new RegExp(`^/?${bucket}/?`), "")
      .replace(/^\/+/, "");

    let attempts = 0;
    const maxAttempts = 3;
    const delayMs = 600;

    while (attempts < maxAttempts) {
      attempts++;
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath, expiresIn);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }

      // Jika objek belum terbaca, beri jeda singkat lalu coba lagi
      if (attempts < maxAttempts) {
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error(
          `❌ Supabase Storage Error [Bucket: ${bucket}, Path: ${cleanPath}]:`,
          error,
        );
        throw error;
      }
    }

    throw new Error("Failed to generate signed URL after retries");
  }

  async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, { contentType, upsert: true });

    if (error) throw error;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    await supabase.storage.from(bucket).remove([path]);
  }

  async updateQrConfig(
    id: string,
    qrConfig: QrConfig,
  ): Promise<CertificateRow> {
    const { data, error } = await supabase
      .from("certificates")
      .update({ qr_config: qrConfig, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as CertificateRow;
  }
}
