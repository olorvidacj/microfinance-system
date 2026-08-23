import 'dotenv/config';

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(
    `[config] Missing required environment variables: ${missing.join(', ')}`
  );
  console.error('[config] Copy backend/.env.example to backend/.env and fill in values.');
  process.exit(1);
}

const parseList = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  supabaseUrl: process.env.SUPABASE_URL.trim(),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  corsOrigins: parseList(process.env.CORS_ORIGINS),
};
