import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // The database-backed suites create and drop scratch databases against the
    // real connection in .env, so they must not run in parallel with each other.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
