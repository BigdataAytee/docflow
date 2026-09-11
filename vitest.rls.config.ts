import { defineConfig } from 'vitest/config'

// The RLS suite is separated from `npm test` because it needs a Postgres.
// `npm test` stays database-free and fast; CI runs both, and both block.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    // Policies are asserted against one shared schema; keep it serial.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
