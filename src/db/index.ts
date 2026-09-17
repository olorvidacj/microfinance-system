import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let poolInstance: pg.Pool | null = null;
let activeConnectionString: string = '';
const failedConnectionStrings = new Set<string>();

/**
 * Checks if a database connection URL is an unconfigured template/placeholder.
 */
export function isPlaceholderConnectionString(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();

  if (
    lower.includes('your-project') ||
    lower.includes('your_project') ||
    lower.includes('your-project-ref') ||
    lower.includes('placeholder') ||
    lower.includes('example.com') ||
    lower.includes('<') ||
    lower.includes('>') ||
    lower.includes('user:password@') ||
    lower.includes('postgres:password@') ||
    lower.includes('postgres.your-project') ||
    lower.includes('db.your-project')
  ) {
    return true;
  }

  // Localhost connection in container environment with no local daemon
  if (lower.includes('localhost:5432') || lower.includes('127.0.0.1:5432')) {
    return true;
  }

  return false;
}

export function markConnectionStringFailed(url?: string) {
  if (url) {
    failedConnectionStrings.add(url);
    if (activeConnectionString === url) {
      if (poolInstance) {
        try {
          poolInstance.end().catch(() => {});
        } catch {}
      }
      poolInstance = null;
      dbInstance = null;
      activeConnectionString = '';
    }
  }
}

export function resolveActiveConnectionString(overrideUrl?: string): string {
  const candidates = [
    overrideUrl,
    process.env.SUPABASE_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.CLOUD_SQL_DATABASE_URL,
  ];

  for (const candidate of candidates) {
    if (candidate && !isPlaceholderConnectionString(candidate) && !failedConnectionStrings.has(candidate)) {
      return candidate.trim();
    }
  }

  return '';
}

export function getPool(overrideUrl?: string): pg.Pool | null {
  const connectionString = resolveActiveConnectionString(overrideUrl);

  if (!connectionString) {
    return null;
  }

  if (!poolInstance || activeConnectionString !== connectionString) {
    getDb(overrideUrl);
  }

  return poolInstance;
}

export function getDb(overrideUrl?: string) {
  const connectionString = resolveActiveConnectionString(overrideUrl);

  if (!connectionString) {
    return null;
  }

  // If connection string changed or not initialized, recreate pool
  if (!dbInstance || activeConnectionString !== connectionString) {
    try {
      if (poolInstance) {
        poolInstance.end().catch(() => {});
      }

      // Check if SSL is required (Supabase, Neon, Cloud SQL, AWS RDS require SSL)
      const isRemoteCloudDb = connectionString.includes('supabase') ||
        connectionString.includes('amazonaws') ||
        connectionString.includes('neon.tech') ||
        connectionString.includes('pooler.supabase.com') ||
        connectionString.includes('sslmode=require');

      const pool = new Pool({
        connectionString,
        ssl: isRemoteCloudDb ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        max: 10,
      });

      pool.on('error', (err: any) => {
        const msg = String(err?.message || '');
        if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) {
          markConnectionStringFailed(connectionString);
        }
      });

      poolInstance = pool;
      dbInstance = drizzle(poolInstance, { schema });
      activeConnectionString = connectionString;
    } catch (err) {
      console.warn('[Database] Failed to initialize connection pool:', err);
      markConnectionStringFailed(connectionString);
      return null;
    }
  }

  return dbInstance;
}

export async function testDbConnection(customUrl?: string): Promise<{ success: boolean; message: string; databaseType?: string; tables?: string[]; latencyMs?: number }> {
  const connectionString = customUrl
    ? customUrl.trim()
    : resolveActiveConnectionString();

  if (!connectionString || isPlaceholderConnectionString(connectionString)) {
    return {
      success: false,
      message: 'No valid database connection string configured. Set SUPABASE_DATABASE_URL or DATABASE_URL with real credentials.',
    };
  }

  const isRemoteCloudDb = connectionString.includes('supabase') ||
    connectionString.includes('amazonaws') ||
    connectionString.includes('neon.tech') ||
    connectionString.includes('pooler.supabase.com') ||
    connectionString.includes('sslmode=require');

  const testPool = new Pool({
    connectionString,
    ssl: isRemoteCloudDb ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  });

  const startTime = Date.now();
  try {
    const client = await testPool.connect();
    const result = await client.query(`
      SELECT 
        version(), 
        current_database() as db_name, 
        current_user as user_name,
        NOW() as current_time
    `);
    
    // Check available tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = tablesResult.rows.map(r => r.table_name);

    client.release();
    await testPool.end();

    const latencyMs = Date.now() - startTime;
    const isSupabase = connectionString.includes('supabase') || (result.rows[0]?.version || '').toLowerCase().includes('supabase');

    return {
      success: true,
      message: `Successfully connected to ${isSupabase ? 'Supabase PostgreSQL' : 'PostgreSQL'} database "${result.rows[0]?.db_name}" (${latencyMs}ms)`,
      databaseType: isSupabase ? 'Supabase PostgreSQL' : 'PostgreSQL Database',
      tables,
      latencyMs,
    };
  } catch (error: any) {
    try {
      await testPool.end();
    } catch {}
    return {
      success: false,
      message: error.message || 'Failed to connect to database',
    };
  }
}

export { schema };

