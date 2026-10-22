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
let supabaseMarkedFailed = false;
const SUPABASE_TIMEOUT_MS = 5000;

export function markServerSupabaseFailed(): void {
  supabaseMarkedFailed = true;
  if (serverSupabaseClient) {
    serverSupabaseClient = null;
  }
}

export function isServerSupabaseFailed(): boolean {
  return supabaseMarkedFailed;
}

function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const hasSignal = init?.signal instanceof AbortSignal;
  const merged: RequestInit = hasSignal || typeof AbortSignal.timeout !== 'function'
    ? { ...(init || {}) }
    : { ...(init || {}), signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS) };
  return fetch(input, merged);
}

export function isPlaceholderSupabaseUrl(url?: string | null): boolean {
  if (!url) return true;
  const lower = url.toLowerCase().trim();
  return (
    lower.includes('your-project') ||
    lower.includes('your_project') ||
    lower.includes('your-project-ref') ||
    lower.includes('placeholder') ||
    lower.includes('example.com') ||
    lower.includes('<') ||
    lower.includes('>')
  );
}

function supabaseUrlFromEnv(): string {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
}

/** Whether this server is pointed at a real Supabase project (whatever keys it has). */
export function isSupabaseConfigured(): boolean {
  const url = supabaseUrlFromEnv();
  return Boolean(url) && !isPlaceholderSupabaseUrl(url);
}

/**
 * A client that always acts as the service role.
 *
 * supabase-js sends the current session's access token instead of the key once
 * anything signs in on a client. Pinning Authorization to the service key means
 * a sign-in can never turn this client into a user: Storage and PostgREST calls
 * stay service-role whatever happens on its auth API.
 */
export function createServiceRoleClient(url: string, serviceKey: string, fetchImpl: typeof fetch = timeoutFetch): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchImpl, headers: { Authorization: `Bearer ${serviceKey}` } },
  });
}

/**
 * The shared service-role client, or null when this server has no service-role
 * key. It never falls back to the anon key: an anon client here would make
 * every server-side upload and write an anonymous request, refused by RLS.
 * Use it for admin and data work only, never to sign a user in.
 */
export function getServerSupabase(): SupabaseClient | null {
  const supabaseUrl = supabaseUrlFromEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (supabaseMarkedFailed) return null;
  if (!serviceKey || !isSupabaseConfigured()) {
    return null;
  }

  if (!serverSupabaseClient) {
    try {
      serverSupabaseClient = createServiceRoleClient(supabaseUrl, serviceKey);
    } catch (err) {
      console.error('[Server Supabase] Failed to initialize server-side client:', err);
      return null;
    }
  }

  return serverSupabaseClient;
}

/**
 * A new client for one user-facing auth call (password sign-in, email codes,
 * password reset). The session such a call creates stays in this throwaway
 * client and is never shared with other requests. Uses the public anon key,
 * as these are public flows; the service key only when no anon key is set.
 */
export function createAuthFlowClient(fetchImpl: typeof fetch = timeoutFetch): SupabaseClient | null {
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (supabaseMarkedFailed || !key || !isSupabaseConfigured()) return null;
  return createClient(supabaseUrlFromEnv(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchImpl },
  });
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
