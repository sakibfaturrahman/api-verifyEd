import { supabase } from "../../config/supabase";
import { logger } from "../../core/utils/logger";

export interface VerificationLogInput {
  certificate_id?: string;
  method: "qr" | "pdf" | "certificate_id";
  result: "verified" | "revoked" | "not_found";
  ip_address?: string;
  user_agent?: string;
}

export class VerificationRepository {
  async createLog(input: VerificationLogInput): Promise<void> {
    const { error } = await supabase.from("verification_logs").insert({
      certificate_id: input.certificate_id ?? null,
      method: input.method,
      result: input.result,
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
    });

    // Log errors but don't throw — verification logging must never break the main flow
    if (error) {
      logger.error({ error }, "Failed to write verification log");
    }
  }

  async getStats(opts?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    total: number;
    verified: number;
    revoked: number;
    not_found: number;
    byMethod: { qr: number; pdf: number; certificate_id: number };
  }> {
    let query = supabase
      .from("verification_logs")
      .select("result, method", { count: "exact" });

    if (opts?.startDate) {
      query = query.gte("created_at", opts.startDate);
    }
    if (opts?.endDate) {
      query = query.lte("created_at", opts.endDate);
    }

    const { data, error } = await query;
    if (error || !data) {
      return {
        total: 0,
        verified: 0,
        revoked: 0,
        not_found: 0,
        byMethod: { qr: 0, pdf: 0, certificate_id: 0 },
      };
    }

    const total = data.length;
    const verified = data.filter((d) => d.result === "verified").length;
    const revoked = data.filter((d) => d.result === "revoked").length;
    const not_found = data.filter((d) => d.result === "not_found").length;
    const byMethod = {
      qr: data.filter((d) => d.method === "qr").length,
      pdf: data.filter((d) => d.method === "pdf").length,
      certificate_id: data.filter((d) => d.method === "certificate_id").length,
    };

    return { total, verified, revoked, not_found, byMethod };
  }

  async getStatsForCertificate(certificateId: string) {
    const { data, error } = await supabase
      .from("verification_logs")
      .select("result, method, created_at")
      .eq("certificate_id", certificateId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data;
  }

  async getLogs(opts?: { page?: number; limit?: number }) {
    const page = Math.max(Number(opts?.page) || 1, 1);
    const limit = Math.max(Number(opts?.limit) || 10, 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("verification_logs")
      .select(
        `
        id,
        method,
        result,
        ip_address,
        user_agent,
        created_at,
        certificates (
          certificate_number,
          recipient_name,
          events (
            name
          )
        )
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      logger.error({ error }, "Failed to fetch verification logs");
      throw error;
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
    };
  }
}
