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
import type { UiStrings } from '../../domain/locale/data/strings'
import type { ExportOutcome } from '../export/action'
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
  /**
   * Runs the export. Optional only so the component can be rendered in a test
   * without one — every real caller passes it, and a test asserts that the
   * screen does.
   *
   * It was optional and UNPASSED for four phases: the button rendered under
   * the sentence promising Rule #6 and did nothing at all.
   */
  readonly onExport?: () => Promise<ExportOutcome> | void
  readonly demoPersonName?: string
}

/** What the last export did, said plainly (§N: never dressed up). */
function exportMessage(outcome: ExportOutcome, strings: UiStrings): string {
  switch (outcome.kind) {
    case 'shared':
    case 'copied':
      return `${strings.dataSync.exportDone} ${outcome.filename}`
    case 'incomplete':
      return `${strings.dataSync.exportIncomplete} ${outcome.result.failed
        .map((entry) => entry.part)
        .join(', ')}`
    case 'unavailable':
      return strings.dataSync.exportUnavailable
    case 'failed':
      return strings.dataSync.exportFailed
  }
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
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)

  const handleExport = async (): Promise<void> => {
    if (onExport === undefined || exporting) return
    setExporting(true)
    setExportNote(null)
    try {
      const outcome = await onExport()
      // A caller that returns nothing said nothing; inventing "Exported" here
      // would be a claim about a file this component never saw.
      if (outcome !== undefined) setExportNote(exportMessage(outcome, strings))
    } finally {
      setExporting(false)
    }
  }

  const uploadState =
    failedCount > 0
      ? strings.sync.needsReview
      : pendingCount > 0
        ? strings.sync.waiting
        : strings.sync.uploaded

  return (
    <section className="space-y-4 px-4 py-4" aria-label={strings.dataSync.title}>
      <div className="glass rounded-2xl p-4">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="opacity-70">{strings.dataSync.uploadState}</span>
          <span className="font-medium">{uploadState}</span>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <button
          type="button"
          className="raised tap-scale min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white"
          onClick={() => {
            void handleExport()
          }}
          disabled={onExport === undefined || exporting}
        >
          {exporting ? strings.common.loading : strings.dataSync.exportAll}
        </button>
        <p className="mt-2 text-xs opacity-70">{strings.dataSync.exportAlwaysFree}</p>
        {exportNote !== null && (
          <p className="mt-2 text-xs font-medium" role="status">
            {exportNote}
          </p>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        <p className="text-sm font-semibold">{strings.dataSync.conflictDemo}</p>
        <p className="mt-0.5 text-xs opacity-70">{strings.dataSync.conflictDemoHint}</p>
        <button
          type="button"
          className="mt-3 min-h-tap rounded-full border border-edge/10 bg-surface px-4 text-sm font-medium"
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
