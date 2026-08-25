import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let poolInstance: pg.Pool | null = null;
let activeConnectionString: string = '';

export function getPool(overrideUrl?: string): pg.Pool | null {
  const connectionString = overrideUrl ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.CLOUD_SQL_DATABASE_URL ||
    '';

  if (!connectionString) {
    return null;
  }

  if (!poolInstance || activeConnectionString !== connectionString) {
    getDb(overrideUrl);
  }

  return poolInstance;
}

export function getDb(overrideUrl?: string) {
  const connectionString = overrideUrl ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.CLOUD_SQL_DATABASE_URL ||
    '';

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

      poolInstance = new Pool({
        connectionString,
        ssl: isRemoteCloudDb ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10,
      });

      dbInstance = drizzle(poolInstance, { schema });
      activeConnectionString = connectionString;
    } catch (err) {
      console.error('[Database] Failed to initialize connection pool:', err);
      return null;
    }
  }

  return dbInstance;
}

export async function testDbConnection(customUrl?: string): Promise<{ success: boolean; message: string; databaseType?: string; tables?: string[]; latencyMs?: number }> {
  const connectionString = customUrl ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.CLOUD_SQL_DATABASE_URL ||
    '';

  if (!connectionString) {
    return {
      success: false,
      message: 'No database connection string configured. Set SUPABASE_DATABASE_URL or DATABASE_URL.',
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

