import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'shared/kyc-core/**/*.test.ts', 'shared/lending/**/*.test.ts', 'shared/auth/**/*.test.ts', 'shared/client/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // Database-backed suites run on in-process PGlite (src/db/testing); they are
    // slow to boot, so files run one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    // Vitest copies VITE_* values from .env into process.env, and the server
    // falls back to them for Supabase. Tests must never reach a real project,
    // database, mailbox or AI service.
    env: {
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_ANON_KEY: '',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      DATABASE_URL: '',
      SUPABASE_DATABASE_URL: '',
      CLOUD_SQL_DATABASE_URL: '',
      GMAIL_USER: '',
      GMAIL_APP_PASSWORD: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      GEMINI_API_KEY: '',
      AUTH_SECRET: 'test-only-secret',
    },
  },
});
