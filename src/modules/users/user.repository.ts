import { supabase } from '../../config/supabase';
import { ProfileRow } from '../auth/auth.repository';
import { UpdateProfileDto } from './user.validation';

export class UserRepository {
  async findById(id: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as ProfileRow;
  }

  async update(id: string, dto: UpdateProfileDto): Promise<ProfileRow> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as ProfileRow;
  }

  // Admin only
  async findAll(opts: {
    page: number;
    limit: number;
    offset: number;
    search?: string;
    status?: string;
    role?: string;
  }): Promise<{ data: ProfileRow[]; total: number }> {
    let query = supabase.from('profiles').select('*', { count: 'exact' });

    if (opts.search) {
      query = query.or(`name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`);
    }
    if (opts.status) {
      query = query.eq('status', opts.status);
    }
    if (opts.role) {
      query = query.eq('role', opts.role);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);

    if (error) throw error;
    return { data: (data as ProfileRow[]) ?? [], total: count ?? 0 };
  }

  async updateStatus(id: string, status: 'active' | 'inactive'): Promise<ProfileRow> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as ProfileRow;
  }

  async deleteUser(id: string): Promise<void> {
    // Deletes from auth.users (CASCADE deletes profile)
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}
