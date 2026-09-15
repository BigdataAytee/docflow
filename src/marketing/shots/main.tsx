/**
 * The screenshot build's entry point.
 *
 * A separate entry, built by `vite.shots.config.ts` into `dist-shots`, so that
 * **none of this reaches the app anybody installs**. `src/main.tsx` does not
 * import it, the app build never sees it, and a test asserts the fixtures are
 * absent from `dist/` rather than trusting the arrangement.
 *
 * It renders the REAL `App` against in-memory repositories holding the
 * screenshot fixtures — the same components, the same routing, the same
 * locale resolution. A mock of the app would photograph a mock.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '../../app/App'
import { createMemoryRepositories } from '../../data/repositories'
import '../../index.css'
import { SHOT_COMPANY_ID, shotState } from './fixtures'

const root = document.getElementById('root')
if (root === null) throw new Error('Missing #root')

/** `?region=GB`. The capture sets it; there is no default worth guessing. */
const region = new URLSearchParams(window.location.search).get('region') ?? 'NG'

const loadBackend = async () =>
  ({
    kind: 'demo' as const,
    companyId: SHOT_COMPANY_ID,
    repositories: createMemoryRepositories(shotState(region, SHOT_COMPANY_ID)),
    // A browser tab, and the frames carry the banner that says so — §T notes
    // them as drafts until the app can be shot signed in to a real project.
    durable: false,
  })

createRoot(root).render(
  <StrictMode>
    <App loadBackend={loadBackend} />
  </StrictMode>,
)
