import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

import { securityMetaTags } from './src/web/csp'

/**
 * The security meta tags, injected into the BUILT index.html only.
 *
 * Build only because Vite's dev server serves an inline module preamble and
 * an HMR client, and `script-src 'self'` would refuse both — a policy that
 * breaks `npm run dev` is a policy somebody deletes. The built document is
 * what ships to a host and into the Capacitor APK, and `src/web/csp.test.ts`
 * asserts the tags are in it rather than trusting this to have run.
 */
const securityHeaders = (): Plugin => ({
  name: 'docflow-security-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('</head>', `  ${securityMetaTags()}
  </head>`),
})

// The web client is online-only (§B) but `npm run dev` boots against the
// in-memory repositories so the UI can be built before Supabase exists.
export default defineConfig({
  plugins: [react(), securityHeaders()],
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
    // Vitest's default is 5s per test, which is a statement about the machine
    // rather than about the code. On a slow laptop — or a CI box running the
    // suite beside a build — standing up jsdom for 148 files eats most of
    // that budget before a test body starts, and the suite reported 57
    // failures where the clean run has 4.
    //
    // A timeout cascade is worse than slow: a test that times out leaves its
    // component mounted and its half-finished interaction in flight, so the
    // stray click lands on the NEXT test's render and fails it too, with an
    // assertion error that looks nothing like a timeout. One machine hiccup
    // becomes a page of unrelated red, and the real failures hide in it.
    //
    // 30s is not a licence for slow tests. Nothing here takes more than a
    // second on a warm machine; the headroom exists so that a genuine
    // failure is the only thing that ever goes red.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
