import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// The web client is online-only (§B) but `npm run dev` boots against the
// in-memory repositories so the UI can be built before Supabase exists.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    // jsdom for the screens; the domain suites do not care either way.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // `tools` is in here too: the migration is not app code, but it converts
    // somebody's money and its rehearsal has to block a release exactly as the
    // money tests do (§Q Phase 7).
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tools/**/*.test.ts'],
  },
})
