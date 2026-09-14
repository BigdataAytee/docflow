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
import { label as typeLabel, labelInSentence } from '../../domain/locale/profile'
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
  /**
   * What the header calls this document.
   *
   * Absent means CREATING, and the header says "New invoice". Present means
   * an existing draft was opened, and it says the draft's own reference —
   * because "New invoice" over a document somebody started last Tuesday is a
   * lie, and the reference is what they will look for when they come back to
   * it. A draft with no reference yet falls back to the plain type name.
   */
  readonly reference?: string
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
  reference,
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
  // "New invoice" and "Save invoice" put the word INSIDE a sentence, so they
  // take the sentence form; the header's fallback is the name standing alone
  // and keeps the standalone one (§D).
  const inSentence = labelInSentence(profile, type)
  const title =
    reference === undefined
      ? format(strings.builder.newDocument, { label: inSentence })
      : reference === ''
        ? label
        : reference

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header
        className="relative flex items-center gap-2.5 px-3 py-2.5 text-white"
        style={{
          // The type's three stops, at 158deg. No rounded edge and no corner
          // circle here: this band is a toolbar, and the hero treatment would
          // make it compete with the document being built.
          backgroundImage: `linear-gradient(158deg, ${palette.light}, ${palette.accent} 58%, ${palette.deep})`,
          boxShadow: `0 8px 22px -6px ${palette.accent}80`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="tap-scale grid min-h-tap min-w-tap place-items-center rounded-full"
        >
          <Icon name="x" size={1.15} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-[13px] font-semibold leading-tight">{title}</h1>
          {/* Only ever claims a save that actually committed (§C). */}
          <p className="text-[9.5px] text-white/70">
            {dirty || lastSavedAt === undefined
              ? strings.common.savingAutomatically
              : strings.common.saved}
          </p>
        </div>
      </header>

      {/*
        The five-segment step bar — and every step NAMED, not just the current
        one. The prototype shows all five, and it is the better answer for the
        same reason the nav's dash is: a person who cannot see the colour
        difference between segment three and segment four can still read
        "Totals". It also means each control carries its own visible label
        rather than an `aria-label` nobody else can check.
      */}
      <nav
        className="flex gap-1 px-3 pb-0.5 pt-2.5"
        aria-label={format(strings.builder.stepOf, { current: step + 1, total: STEP_COUNT })}
      >
        {names.map((name, index) => {
          const reached = index <= step
          return (
            <button
              key={name}
              type="button"
              onClick={() => onStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className="min-w-0 flex-1 text-center text-[8.5px] font-semibold leading-tight"
              // The accent is fine inline — §F locks it in both themes. Its
              // opposite is a token, because a grey that reads as "quiet" on
              // a white page reads as "invisible" on a dark one.
              style={{ color: reached ? palette.accent : 'var(--step-pending-ink)' }}
            >
              <span
                aria-hidden="true"
                className="mb-1 block h-[3px] rounded-full"
                style={
                  reached
                    ? {
                        backgroundImage: `linear-gradient(90deg, ${palette.light}, ${palette.accent})`,
                      }
                    : { backgroundColor: 'var(--step-pending-bar)' }
                }
              />
              <span className="block [overflow-wrap:anywhere]">{name}</span>
            </button>
          )
        })}
      </nav>

      <main className="flex-1 overflow-y-auto px-3 py-1.5">{children}</main>

      {/*
        Pinned, where the prototype lets it scroll away with the content.
        §G asks for "Back/Next at the bottom" and the spec adds "keep Next
        reachable"; a form that is four cards long on a 360px phone puts its
        primary action off screen the moment somebody starts typing.
      */}
      <footer
        data-safe-bottom
        // `sticky`, not merely last in a flex column. The column is
        // `min-h-dvh`, so anything above the builder — the demo banner, and
        // on a phone the status bar — pushes the row below the fold: measured
        // at 4px of a 56px bar visible. A primary action you have to scroll
        // to find is the thing keeping it at the bottom was meant to prevent.
        className="glass-solid sticky bottom-0 z-10 flex gap-2 border-t border-edge/5 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          onClick={() => onStep(step - 1)}
          disabled={step === 0}
          className="glass-pill tap-scale min-h-tap flex-1 rounded-full text-[11.5px] font-semibold text-ink/60 disabled:opacity-40"
        >
          {strings.common.back}
        </button>
        <button
          type="button"
          onClick={() => (isLastStep(step) ? onSave() : onStep(step + 1))}
          className="tap-scale min-h-tap flex-[2] rounded-full text-[11.5px] font-semibold text-white"
          style={{
            backgroundImage: `linear-gradient(160deg, ${palette.light}, ${palette.accent} 60%, ${palette.deep})`,
            boxShadow: `0 10px 22px -6px ${palette.accent}8c, inset 0 1px 0 rgb(255 255 255 / 0.35)`,
          }}
        >
          {primaryAction(step) === 'save'
            ? format(strings.builder.saveDocument, { label: inSentence })
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
