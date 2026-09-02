import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase client using SERVICE ROLE KEY.
 * This client bypasses Row Level Security and must ONLY be used server-side.
 * Never expose this client or the service role key to any frontend.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

/**
 * Supabase client using ANON KEY.
 * Used for verifying user JWT tokens via supabase.auth.getUser(token).
 */
export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

/**
 * Test database connectivity by making a lightweight query.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    // An error that is NOT "relation does not exist" means the DB is reachable
    if (error && error.message.includes('relation "profiles" does not exist')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
