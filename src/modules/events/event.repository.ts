import { supabase } from "../../config/supabase";
import { CreateEventDto, UpdateEventDto } from "./event.validation";

export interface EventRow {
  id: string;
  user_id: string;
  name: string;
  organizer: string;
  description: string | null;
  event_date: string;
  location: string | null;
  status: "draft" | "ongoing" | "completed";
  created_at: string;
  updated_at: string;
}

export interface EventWithCertCount extends EventRow {
  certificatesCount: number;
}

export interface ListEventsParams {
  userId: string;
  page?: number;
  limit: number;
  offset: number;
  search?: string;
  status?: string;
}

export class EventRepository {
  async create(userId: string, dto: CreateEventDto): Promise<EventRow> {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...dto, user_id: userId })
      .select("*")
      .single();

    if (error) throw error;
    return data as EventRow;
  }

  async findAll({
    userId,
    limit,
    offset,
    search,
    status,
  }: ListEventsParams): Promise<{ data: EventWithCertCount[]; total: number }> {
    let query = supabase
      .from("events")
      .select(
        `
        *,
        certificates(count)
      `,
        { count: "exact" },
      )
      .eq("user_id", userId);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // Normalisasi struktur nested count Supabase ke angka murni
    const formattedData: EventWithCertCount[] = (data || []).map(
      (event: any) => ({
        ...event,
        certificatesCount: event.certificates?.[0]?.count ?? 0,
      }),
    );

    return {
      data: formattedData,
      total: count ?? 0,
    };
  }

  async findById(id: string): Promise<EventRow | null> {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return null;
    return data as EventRow;
  }

  async findByIdAndOwner(id: string, userId: string): Promise<EventRow | null> {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) return null;
    return data as EventRow;
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventRow> {
    const { data, error } = await supabase
      .from("events")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as EventRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
  }

  async getCertificateCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (error) return 0;
    return count ?? 0;
  }
}

export default EventRepository;
