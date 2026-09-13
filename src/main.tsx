/**
 * The composition root.
 *
 * The one place that reads the environment. It decides nothing else: `App`
 * takes a LOADER rather than a backend, so nothing below here — and no test —
 * has to know that `import.meta.env` exists, and nothing is fetched until a
 * route needs it.
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

const loadBackend = () =>
  createBackend(env, async () => {
    const [{ DEV_COMPANY_ID, devState }, { createMemoryRepositories }] = await Promise.all([
      import('./app/seed'),
      import('./data/repositories'),
    ])
    return {
      companyId: DEV_COMPANY_ID,
      repositories: createMemoryRepositories(devState(DEV_COMPANY_ID)),
    }
  })

createRoot(root).render(
  <StrictMode>
    <App loadBackend={loadBackend} />
  </StrictMode>,
)
