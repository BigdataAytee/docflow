/**
 * Settings → Data & sync (§G, §L7).
 *
 * "Upload state, storage used, export all my data, sync-conflict demo."
 *
 * The demo is the §L7 chooser driven by a fixed, made-up example rather than
 * by anything on the device. Two rules shape it:
 *
 *  · It is labelled as an example, on screen, while it is open. A worked
 *    example that looks like live data is worse than no demo — the owner would
 *    think a real document was in dispute.
 *  · Choosing in the demo writes nothing. It is a preview of a decision, not
 *    the decision.
 *
 * The export line states §A Rule #6 plainly: documents are never hostage, and
 * export is free forever, on any plan.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { ConflictChooser } from '../../sync/ConflictChooser'
import type { ConflictChoice, Resolution } from '../../sync/conflicts'

/** A fixed example. Deliberately not derived from anything on the device. */
const DEMO: Extract<Resolution, { kind: 'conflict' }> = {
  kind: 'conflict',
  fields: ['deliveryAddress'],
  mine: { deliveryAddress: '14 Adeola Odeku, Victoria Island' },
  theirs: { deliveryAddress: '14 Adeola Odeku St, VI, Lagos' },
}

export interface DataAndSyncProps {
  readonly pendingCount: number
  readonly failedCount: number
  readonly onExport?: () => void
  readonly demoPersonName?: string
}

export function DataAndSync({
  pendingCount,
  failedCount,
  onExport,
  demoPersonName = 'Sola',
}: DataAndSyncProps) {
  const { strings } = useCompany()
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoChoice, setDemoChoice] = useState<ConflictChoice | null>(null)

  const uploadState =
    failedCount > 0
      ? strings.sync.needsReview
      : pendingCount > 0
        ? strings.sync.waiting
        : strings.sync.uploaded

  return (
    <section className="space-y-4 px-4 py-4" aria-label={strings.dataSync.title}>
      <div className="rounded-2xl bg-white/70 p-4 backdrop-blur">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="opacity-70">{strings.dataSync.uploadState}</span>
          <span className="font-medium">{uploadState}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white/70 p-4 backdrop-blur">
        <button
          type="button"
          className="min-h-tap w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white"
          onClick={onExport}
        >
          {strings.dataSync.exportAll}
        </button>
        <p className="mt-2 text-xs opacity-70">{strings.dataSync.exportAlwaysFree}</p>
      </div>

      <div className="rounded-2xl bg-white/70 p-4 backdrop-blur">
        <p className="text-sm font-semibold">{strings.dataSync.conflictDemo}</p>
        <p className="mt-0.5 text-xs opacity-70">{strings.dataSync.conflictDemoHint}</p>
        <button
          type="button"
          className="mt-3 min-h-tap rounded-full border border-black/10 bg-white px-4 text-sm font-medium"
          aria-expanded={demoOpen}
          onClick={() => {
            setDemoOpen((open) => !open)
            setDemoChoice(null)
          }}
        >
          {demoOpen ? strings.dataSync.hideExample : strings.dataSync.showExample}
        </button>

        {demoOpen && (
          <div className="mt-3 space-y-2">
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900">
              {strings.dataSync.demoNotice}
            </p>
            <ConflictChooser
              resolution={DEMO}
              otherPersonName={demoPersonName}
              onChoose={(choice) => setDemoChoice(choice)}
            />
            {demoChoice !== null && (
              <p className="text-xs opacity-70" role="status">
                {strings.conflict.bothSaved}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
