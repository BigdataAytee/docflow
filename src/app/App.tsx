/**
 * Phase 0 shell.
 *
 * §X is explicit that this document "does not claim a deployed React/Capacitor
 * build". So this shell claims nothing either: it reports which gates have
 * actually passed, and is replaced by the real routes in Phase 1–2 (§Q).
 */

import { DOCUMENT_TYPES } from '../domain/documents/types'
import { LAUNCH_LOCALES, TERMINOLOGY_TABLES } from '../domain/locale/data/terminology'

/**
 * Mirrors PLAN.md's status board. "Code complete" is not "gate passed": every
 * gate below that needs a physical device is still open, and this page says so
 * rather than colouring a row green (§X).
 */
const PHASES = [
  { id: 0, name: 'Spikes and reconciliation', state: 'in progress — spikes need devices' },
  { id: 1, name: 'Foundation', state: 'code complete — gate not passed' },
  { id: 2, name: 'Core offline app', state: 'code complete — gate needs a device' },
  { id: 2.5, name: 'The remaining improvements', state: 'code complete' },
  { id: 3, name: 'Sync', state: 'code complete — gate verified at logic level' },
  { id: 4, name: 'Native polish', state: 'not started' },
  { id: 5, name: 'Web and public links', state: 'not started' },
  { id: 6, name: 'Local AI and logo', state: 'not started' },
  { id: 7, name: 'Admin, hardening, migration, launch', state: 'not started' },
] as const

export function App() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">DocFlow</h1>
        <p className="mt-1 text-sm opacity-70">
          Build v6. The product is finished when the gates pass — not when the screens
          resemble the prototype (§X).
        </p>
      </header>

      <section className="mb-8 rounded-2xl bg-white/70 p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-60">Phases</h2>
        <ul className="space-y-1.5 text-sm">
          {PHASES.map((phase) => (
            <li key={phase.id} className="flex justify-between gap-4">
              <span>
                <span className="opacity-50">Phase {phase.id}</span> · {phase.name}
              </span>
              <span className="shrink-0 opacity-60">{phase.state}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white/70 p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-60">
          Terminology drafts in review
        </h2>
        <p className="mb-3 text-sm opacity-70">
          {DOCUMENT_TYPES.length} internal types across {LAUNCH_LOCALES.length} launch locales.
          None is releasable until a native speaker signs it off (§D).
        </p>
        <ul className="space-y-1 text-sm">
          {LAUNCH_LOCALES.map((locale) => (
            <li key={locale} className="flex justify-between gap-4">
              <span>{locale}</span>
              <span className="opacity-60">{TERMINOLOGY_TABLES[locale]?.reviewStatus}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
