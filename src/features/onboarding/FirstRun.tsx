/**
 * First run (§R, §L8).
 *
 * "First run offers 'Create my first invoice' and a labelled sample document."
 *
 * The create action names the document in the local terminology — a trader in
 * Lagos is offered a waybill, a plumber in Manchester a delivery note — which
 * is Rule #5 reaching the very first screen a user sees.
 */

import { useCompany } from '../../app/context'
import { label as typeLabel } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { SampleBadge, TYPE_PALETTE } from '../../ui'
import type { DocumentType } from '../../domain/documents/types'

export interface FirstRunProps {
  /** Which type the first-document button offers. */
  readonly suggestedType: DocumentType
  readonly onCreate: (type: DocumentType) => void
  readonly onViewSample: () => void
}

export function FirstRun({ suggestedType, onCreate, onViewSample }: FirstRunProps) {
  const { profile, strings } = useCompany()
  const label = typeLabel(profile, suggestedType)
  const palette = TYPE_PALETTE[suggestedType]

  return (
    <section className="space-y-4 rounded-2xl bg-white/80 px-6 py-8 text-center">
      <h2 className="text-base font-bold">{strings.firstRun.title}</h2>
      <p className="mx-auto max-w-sm text-sm opacity-70">{strings.firstRun.body}</p>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => onCreate(suggestedType)}
          className="min-h-tap w-full max-w-xs break-words rounded-full px-5 text-sm font-semibold text-white"
          style={{ backgroundColor: palette.accent }}
        >
          {format(strings.firstRun.createFirst, { label })}
        </button>

        <button
          type="button"
          onClick={onViewSample}
          className="flex min-h-tap items-center gap-2 rounded-full px-4 text-sm font-semibold text-navy/70"
        >
          {strings.firstRun.viewSample}
          <SampleBadge label={strings.firstRun.sampleBadge} />
        </button>
      </div>
    </section>
  )
}

/** The banner shown on a sample record itself (§R). */
export function SampleNotice() {
  const { strings } = useCompany()
  return (
    <p
      role="note"
      className="flex items-center gap-2 rounded-2xl bg-status-warn-tint p-3 text-xs text-status-warn"
    >
      <SampleBadge label={strings.firstRun.sampleBadge} />
      {strings.firstRun.sampleNotice}
    </p>
  )
}
