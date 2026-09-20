import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

import { securityMetaTags } from './src/web/csp'
import { headersFile } from './src/web/headers'

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

  /*
   * `_headers`, beside the bundle it protects (§P).
   *
   * Two directives cannot travel in the document — `frame-ancestors`, which
   * browsers ignore in a meta policy, and HSTS, whose whole purpose is the
   * request before the document loads. Without them the clickjacking
   * protection the app believes it has is, on the web, not there at all.
   *
   * Emitted rather than checked in, so it cannot be a stale copy of
   * `src/web/headers.ts` — and so a host that reads this format finds it
   * already in `dist/` without anybody remembering a step. Hosts that do not
   * read it have their equivalents in `docs/deploy/web-headers.md`, written
   * from the same values.
   */
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile() })
  },
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
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tools/**/*.test.ts',
      // The gate's OWN tests need no database — they drive it against an
      // HTTP stub — so they belong in the suite that gates every commit.
      // They were only in the RLS config, which needs Postgres and so does
      // not run here; three of them sat broken for two commits because
      // `npm run verify` never opened the file.
      'supabase/tests/hosted-gate.test.ts',
    ],
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
