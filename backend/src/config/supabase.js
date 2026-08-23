import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Service-role client. Bypasses RLS — must NEVER be exposed to browsers/apps.
 * Authorization still enforced in middleware + RLS for anon-key callers.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'csft-backend' },
  },
});
