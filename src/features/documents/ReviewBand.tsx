/**
 * The review screen's amber band (§G step 5).
 *
 * "A full page at A4 proportions with an amber band listing anything missing;
 * each item links to its step; nothing typed is discarded."
 *
 * The builder hands over problem TOKENS; the words are resolved here, so the
 * band speaks the active language and no rule ever carries a sentence.
 */

import { useCompany } from '../../app/context'
import type { IssueProblem } from './builder'

export interface ReviewBandProps {
  readonly problems: readonly IssueProblem[]
  readonly onGoToStep: (step: number) => void
  /**
   * Where a payment problem is fixed (§J).
   *
   * Payment setup lives in Settings, so "each item links to its step" has no
   * useful answer for those two — and the band had been sending people to the
   * Totals step, which cannot fix either of them. Optional so the band can
   * still be rendered without a router; the button falls back to the step.
   */
  readonly onSetUpPayment?: () => void
}

export function ReviewBand({ problems, onGoToStep, onSetUpPayment }: ReviewBandProps) {
  const { strings } = useCompany()
  if (problems.length === 0) return null

  return (
    <section
      className="rounded-2xl bg-status-warn-tint p-4 text-status-warn"
      role="alert"
      aria-label={strings.builder.missingTitle}
    >
      <h2 className="text-sm font-bold">{strings.builder.missingTitle}</h2>
      <ul className="mt-2 space-y-1.5">
        {problems.map((problem) => (
          <li key={`${problem.step}:${problem.field}`} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {/* An unmapped token shows its own name rather than an empty
                  bullet — a silent gap would hide a real missing field. */}
              {strings.problems[problem.field] ?? problem.field}
            </span>
            <button
              type="button"
              onClick={() =>
                problem.fixIn === 'payment_settings' && onSetUpPayment !== undefined
                  ? onSetUpPayment()
                  : onGoToStep(problem.step)
              }
              className="min-h-tap shrink-0 rounded-full px-3 text-xs font-semibold underline"
            >
              {problem.fixIn === 'payment_settings' && onSetUpPayment !== undefined
                ? strings.details.setUpPayment
                : strings.builder.fixThis}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
