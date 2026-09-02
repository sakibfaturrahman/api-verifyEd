import { supabase } from '../../config/supabase';
import { CreateEventDto, UpdateEventDto } from './event.validation';

export interface EventRow {
  id: string;
  user_id: string;
  name: string;
  organizer: string;
  description: string | null;
  event_date: string;
  location: string | null;
  status: 'draft' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
}

export class EventRepository {
  async create(userId: string, dto: CreateEventDto): Promise<EventRow> {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...dto, user_id: userId })
      .select('*')
      .single();

    if (error) throw error;
    return data as EventRow;
  }

  async findAll(opts: {
    userId?: string; // undefined = admin (all events)
    page: number;
    limit: number;
    offset: number;
    search?: string;
    status?: string;
  }): Promise<{ data: EventRow[]; total: number }> {
    let query = supabase.from('events').select('*', { count: 'exact' });

    if (opts.userId) {
      query = query.eq('user_id', opts.userId);
    }
    if (opts.search) {
      query = query.or(`name.ilike.%${opts.search}%,organizer.ilike.%${opts.search}%`);
    }
    if (opts.status) {
      query = query.eq('status', opts.status);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);

    if (error) throw error;
    return { data: (data as EventRow[]) ?? [], total: count ?? 0 };
  }

  async findById(id: string): Promise<EventRow | null> {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error) return null;
    return data as EventRow;
  }

  async findByIdAndOwner(id: string, userId: string): Promise<EventRow | null> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data as EventRow;
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventRow> {
    const { data, error } = await supabase
      .from('events')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as EventRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
  }

  async getCertificateCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from('certificates')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) return 0;
    return count ?? 0;
  }
}
