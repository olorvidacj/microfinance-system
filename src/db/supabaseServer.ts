import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-Side Supabase Client (Node.js & Express)
 * 
 * SECURITY MANDATE:
 * - This module executes exclusively on the backend server.
 * - The SUPABASE_SERVICE_ROLE_KEY is used only here for server-authoritative
 *   operations (e.g. bypassing RLS for admin sync, user provisioning, or secure audit logging).
 * - Never expose or pass SUPABASE_SERVICE_ROLE_KEY to the client-side/browser.
 */

let serverSupabaseClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  if (!serverSupabaseClient) {
    try {
      serverSupabaseClient = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('[Server Supabase] Failed to initialize server-side client:', err);
      return null;
    }
  }

  return serverSupabaseClient;
}

export async function testServerSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  hasServiceRole: boolean;
  latencyMs?: number;
  projectUrl?: string;
}> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const client = getServerSupabase();

  if (!client || !supabaseUrl) {
    return {
      success: false,
      message: 'Supabase server configuration is missing (SUPABASE_URL or keys).',
      hasServiceRole: false,
    };
  }

  const startTime = Date.now();
  try {
    const { data, error } = await client.from('branches').select('id, code, name').limit(1);
    const latencyMs = Date.now() - startTime;

    if (error) {
      // If table does not exist yet, the connection/credentials itself is valid
      if (error.code === 'PGRST205' || error.message.includes('does not exist')) {
        return {
          success: true,
          message: 'Connected to Supabase server-side! Note: Schema tables are pending creation.',
          hasServiceRole,
          latencyMs,
          projectUrl: supabaseUrl,
        };
      }
      return {
        success: false,
        message: `Supabase server error: ${error.message}`,
        hasServiceRole,
        projectUrl: supabaseUrl,
      };
    }

    return {
      success: true,
      message: `Server-side Supabase connection verified successfully (${latencyMs}ms).`,
      hasServiceRole,
      latencyMs,
      projectUrl: supabaseUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Server-side Supabase check failed.',
      hasServiceRole,
    };
  }
}
