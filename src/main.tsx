/**
 * The composition root.
 *
 * The one place that reads the environment and decides which backend the app
 * runs on. `App` takes the answer as a prop, so nothing below here — and no
 * test — has to know that `import.meta.env` exists.
 *
 * A configured project that cannot be built is a hard failure, deliberately.
 * §R: "a local demo is never passed off as an account" — quietly dropping to
 * the demo would hand the owner a sandbox wearing their account's clothes, and
 * whatever they typed into it would be gone.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { DemoBanner } from './app/DemoBanner'
import { createBackend } from './data/backend'
import { DEV_COMPANY_ID, devState } from './app/seed'
import { createMemoryRepositories } from './data/repositories'
import './index.css'

const root = document.getElementById('root')
if (root === null) throw new Error('Missing #root')

// The demo seed is passed IN rather than reached for: `src/data` has no
// business knowing about the app's sample records, and this keeps the seed out
// of an account build's bundle entirely.
const backend = createBackend(
  import.meta.env as unknown as Record<string, string | undefined>,
  () => ({
    companyId: DEV_COMPANY_ID,
    repositories: createMemoryRepositories(devState(DEV_COMPANY_ID)),
  }),
)

createRoot(root).render(
  <StrictMode>
    {backend.kind === 'demo' && <DemoBanner />}
    <App backend={backend} />
  </StrictMode>,
)
