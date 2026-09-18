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
import { createBackend, type Backend } from './data/backend'
import { startApp } from './app/start'
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
 *
 * It is told whether it is native rather than asking, because the SHELL is no
 * longer settled from in here. It used to be, and that was a bug: this
 * function is `createBackend`'s demo loader, so it is never called at all on a
 * build with a Supabase project — and the splash on every account build stayed
 * up over a working app. See `app/start.ts`.
 */
const loadLocalStore = async (native: boolean, shell: typeof import('./native/boot')) => {
  /*
   * THE SAMPLES COME BEFORE THE PLATFORM, and they have to.
   *
   * `VITE_SHOWCASE=1` exists so the twenty sample documents can be LOOKED at.
   * On a phone they could not be: this function opened the encrypted SQLite
   * store on native, which is empty, and `devState` — the only thing that ever
   * calls `showcaseState` — lives in the browser branch below. So the showcase
   * build installed, launched, and showed an empty app. The flag was in the
   * bundle and reached nothing.
   *
   * In memory on a phone too, then. Durability is not what the samples are
   * for, and a set that resets each launch is the honest thing anyway: the
   * banner says these records are cleared, and with this branch that is true
   * on both platforms rather than only on one.
   *
   * Never in an account build. `createBackend` reaches this function only when
   * no Supabase project is configured, so twenty invented invoices cannot land
   * in anybody's ledger (§R).
   */
  const showcase =
    (import.meta.env as unknown as Record<string, string | undefined>).VITE_SHOWCASE === '1'

  if (native && !showcase) {
    const store = await shell.openNativeBackend()
    // Encrypted SQLite: this survives closing the app, and the banner has to
    // say so rather than repeating the browser's answer.
    return { companyId: store.companyId, repositories: store.repositories, durable: true }
  }

  const [{ DEV_COMPANY_ID, devState }, { createMemoryRepositories }] = await Promise.all([
    import('./app/seed'),
    import('./data/repositories'),
  ])
  return {
    companyId: DEV_COMPANY_ID,
    repositories: createMemoryRepositories(devState(DEV_COMPANY_ID)),
    // In memory, in a tab: closing it really does clear everything.
    durable: false,
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
 *
 * The `native/boot` import is not on the CUSTOMER's path: a public link never
 * calls this, which is the case `data/backend` defers both branches for.
 */
const loadBackend = async (): Promise<Backend> => {
  const shell = await import('./native/boot')
  return startApp(
    (native) => createBackend(env, () => loadLocalStore(native, shell)),
    shell,
    () => document.documentElement.classList.add('native'),
  )
}

createRoot(root).render(
  <StrictMode>
    <App loadBackend={loadBackend} />
  </StrictMode>,
)
