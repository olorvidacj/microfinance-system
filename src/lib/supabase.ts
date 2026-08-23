import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  databaseUrl?: string;
  isConfigured: boolean;
}

const STORAGE_KEY = 'hoscomo_supabase_credentials';

export function getSupabaseConfig(): SupabaseConfig {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return {
          url: parsed.url,
          anonKey: parsed.anonKey,
          databaseUrl: parsed.databaseUrl || '',
          isConfigured: true,
        };
      }
    }
  } catch {}

  return {
    url: envUrl,
    anonKey: envAnonKey,
    databaseUrl: '',
    isConfigured: Boolean(envUrl && envAnonKey),
  };
}

export function saveSupabaseConfig(config: { url: string; anonKey: string; databaseUrl?: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    supabaseInstance = null; // reset client instance
  } catch (err) {
    console.error('Failed to save Supabase credentials:', err);
  }
}

export function clearSupabaseConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    supabaseInstance = null;
  } catch {}
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!supabaseInstance && config.url && config.anonKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.warn('Error initializing Supabase client:', err);
    }
  }
  return supabaseInstance;
}

export async function testSupabaseConnection(url?: string, anonKey?: string): Promise<{
  success: boolean;
  message: string;
  projectRef?: string;
  latencyMs?: number;
  tables?: string[];
}> {
  const activeUrl = url || getSupabaseConfig().url;
  const activeKey = anonKey || getSupabaseConfig().anonKey;

  if (!activeUrl || !activeKey) {
    return {
      success: false,
      message: 'Supabase Project URL and Anon/Public Key are required.',
    };
  }

  const startTime = Date.now();
  try {
    const testClient = createClient(activeUrl, activeKey, {
      auth: { persistSession: false },
    });

    // Test a basic read operation or query branches / schema
    const { data, error } = await testClient
      .from('branches')
      .select('id, name, code')
      .limit(5);

    const latencyMs = Date.now() - startTime;
    let projectRef = '';
    try {
      projectRef = new URL(activeUrl).hostname.split('.')[0];
    } catch {}

    if (error) {
      // Check if table just doesn't exist yet (which means credentials are valid, but SQL script needs to run)
      if (error.code === 'PGRST205' || error.message.includes('relation "public.branches" does not exist') || error.message.includes('does not exist')) {
        return {
          success: true,
          message: `Connected to Supabase Project (${projectRef})! Database tables are not created yet. Run the SQL schema script.`,
          projectRef,
          latencyMs,
          tables: [],
        };
      }
      return {
        success: false,
        message: error.message || 'Supabase authentication failed.',
        projectRef,
      };
    }

    return {
      success: true,
      message: `Connected to Supabase (${projectRef}) successfully! (${latencyMs}ms)`,
      projectRef,
      latencyMs,
      tables: ['branches', 'staff', 'borrowers', 'loans', 'savings_accounts', 'payments'],
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Connection attempt timed out or failed.',
    };
  }
}

export const isSupabaseConfigured = Boolean(getSupabaseConfig().isConfigured);
