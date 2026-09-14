/**
 * The builder shell (§G — The builder).
 *
 * "Coloured header with ✕, localised title, 'Draft saved automatically';
 * five-segment step bar; Back/Next at bottom, Next becoming 'Save {label}' on
 * the last step."
 *
 * Every word here resolves through the locale layer — the title, the step
 * names and the save button's label all come from the profile, so switching
 * region changes them together (Rule #5).
 */

import type { ReactNode } from 'react'

import { useCompany } from '../../app/context'
import { label as typeLabel } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { Icon, TYPE_PALETTE } from '../../ui'
import type { DocumentType } from '../../domain/documents/types'
import {
  type IssueProblem,
  type StepIndex,
  STEP_COUNT,
  isLastStep,
  primaryAction,
  stepNames,
} from './builder'

export interface BuilderShellProps {
  readonly type: DocumentType
  readonly step: StepIndex
  readonly dirty: boolean
  readonly lastSavedAt?: string | undefined
  readonly problems: readonly IssueProblem[]
  readonly onStep: (step: number) => void
  readonly onClose: () => void
  readonly onSave: () => void
  readonly children: ReactNode
}

export function BuilderShell({
  type,
  step,
  dirty,
  lastSavedAt,
  problems,
  onStep,
  onClose,
  onSave,
  children,
}: BuilderShellProps) {
  const { profile, strings } = useCompany()
  const palette = TYPE_PALETTE[type]
  const names = stepNames(profile, type)
  const label = typeLabel(profile, type)

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header
        className="sheen-strong relative px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-white"
        style={{
          // §F gives the type its gradient on "headers, hero cards, step bars
          // and accents" alike, so the builder header is the same two stops
          // as the type's tile and its list hero — one document, one colour,
          // wherever you meet it.
          backgroundImage: `linear-gradient(160deg, ${palette.accent}, ${palette.deep})`,
          boxShadow: '0 10px 24px -18px rgb(20 28 74 / 0.55)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.common.cancel}
            className="tap-scale grid min-h-tap min-w-tap place-items-center rounded-full"
          >
            <Icon name="x" size={1.3} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-lg font-bold leading-tight">{label}</h1>
            {/* Only ever claims a save that actually committed (§C). */}
            <p className="text-xs opacity-85">
              {dirty || lastSavedAt === undefined
                ? strings.common.savingAutomatically
                : strings.common.saved}
            </p>
          </div>
        </div>

        <nav
          className="mt-3 flex gap-1.5"
          aria-label={format(strings.builder.stepOf, { current: step + 1, total: STEP_COUNT })}
        >
          {names.map((name, index) => (
            <button
              key={name}
              type="button"
              onClick={() => onStep(index)}
              aria-current={index === step ? 'step' : undefined}
              aria-label={name}
              // Taller than a hairline and inset, so the five segments read as
              // a filled track rather than as five separate rules (§F).
              className={`h-2 flex-1 rounded-full shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)] motion-safe:transition-opacity ${
                index <= step ? 'bg-on-accent/90' : 'bg-on-accent/25'
              }`}
            />
          ))}
        </nav>
        <p className="mt-1.5 text-xs font-medium opacity-90">{names[step]}</p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">{children}</main>

      <footer
        data-safe-bottom
        className="glass-solid flex gap-3 border-t border-edge/5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          onClick={() => onStep(step - 1)}
          disabled={step === 0}
          className="tap-scale min-h-tap flex-1 rounded-full border border-ink/15 bg-surface text-sm font-semibold disabled:opacity-40"
        >
          {strings.common.back}
        </button>
        <button
          type="button"
          onClick={() => (isLastStep(step) ? onSave() : onStep(step + 1))}
          className="raised tap-scale min-h-tap flex-[2] rounded-full text-sm font-semibold text-white"
          style={{ backgroundImage: `linear-gradient(150deg, ${palette.accent}, ${palette.deep})` }}
        >
          {primaryAction(step) === 'save'
            ? format(strings.builder.saveDocument, { label })
            : strings.common.next}
        </button>
      </footer>
      {/* The amber band lives on the review step, rendered by ReviewBand. */}
      <span className="sr-only" role="status">
        {problems.length === 0 ? '' : strings.builder.missingTitle}
      </span>
    </div>
  )
}
