/**
 * The composition root.
 *
 * The one place that reads the environment. It decides nothing else: `App`
 * takes a LOADER rather than a backend, so nothing below here — and no test —
 * has to know that `import.meta.env` exists, and nothing is fetched until a
 * route needs it.
 *
 * There are now two shells and still one UI. `createBackend` is unchanged and
 * still decides account-or-demo from configuration alone (§R: "a local demo is
 * never passed off as an account"). What Phase 4 adds is WHERE the records
 * live when there is no project configured: in a browser that is the
 * in-memory store, and on a phone it is the encrypted SQLite database. The
 * phone is the real product, so the phone gets the real store — and the demo
 * is still named as a demo on screen either way.
 *
 * The demo store is loaded on demand too. That one is for tidiness rather than
 * for bytes — it is a few kilobytes against the Supabase client's 59 — and it
 * is NOT what keeps sample records out of an account build. Nothing needs to:
 * `devState` builds an empty company, and the sample PREVIEW
 * (`features/onboarding/sampleData`) is a real §R feature that every account
 * has, shown rather than seeded so its money never enters a real one.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { createBackend } from './data/backend'
import './index.css'

const root = document.getElementById('root')
if (root === null) throw new Error('Missing #root')

const env = import.meta.env as unknown as Record<string, string | undefined>

/**
 * Records with nowhere online to go.
 *
 * On a phone: the encrypted SQLite store, which is the whole point of Phase 4
 * and what every airplane-mode journey runs against. In a browser: the
 * in-memory store `npm run dev` has always used.
 */
const loadLocalStore = async () => {
  const { isNativePlatform, openNativeBackend, settleShell } = await import('./native/boot')

  if (await isNativePlatform()) {
    document.documentElement.classList.add('native')
    const native = await openNativeBackend()
    // After the backend resolves, never before: the splash and the status bar
    // are not on the cold-start path (§Q Phase 4's < 2s budget).
    void settleShell()
    return { companyId: native.companyId, repositories: native.repositories }
  }

  const [{ DEV_COMPANY_ID, devState }, { createMemoryRepositories }] = await Promise.all([
    import('./app/seed'),
    import('./data/repositories'),
  ])
  return {
    companyId: DEV_COMPANY_ID,
    repositories: createMemoryRepositories(devState(DEV_COMPANY_ID)),
  }
}

/**
 * Note for anyone optimising the cold start: starting the store open HERE, at
 * module evaluation, rather than when React asks for it, was tried and
 * measured on a Pixel 9 Pro XL. It changed nothing — 2248ms before, 2281ms
 * after, inside the noise.
 *
 * The reason is worth keeping so nobody tries it twice. The phases are already
 * sequential and cannot overlap: the WebView has to boot before any JavaScript
 * runs at all, and React's mount is ~50ms against the 1.2s SQLCipher spends
 * deriving the key. There is no idle time to move the work into. See
 * `docs/phase-4/cold-start.md` for the measurements and what would actually
 * help.
 */
const loadBackend = () => createBackend(env, loadLocalStore)

createRoot(root).render(
  <StrictMode>
    <App loadBackend={loadBackend} />
  </StrictMode>,
)
