/**
 * "Ask anything about your business" (§G).
 *
 * The chips are the honest part: each one is a named local query that runs on
 * any phone, offline, from this device's own copy. The text box is present
 * because §G asks for it, and it says plainly that free-form understanding
 * needs the §N offline tools — it never reaches for a network to cover the gap
 * (CLAUDE.md: no silent online fallbacks).
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { formatMoney } from '../customers/formatMoney'
import { ASK_CHIPS, type AskAnswer, type AskChip, type AskFacts, answerChip, answerFreeForm } from './ask'

export interface AskBoxProps {
  readonly facts: AskFacts
  readonly chipLabels: Readonly<Record<AskChip, string>>
  readonly bucketLabels: Readonly<Record<string, string>>
}

export function AskBox({ facts, chipLabels, bucketLabels }: AskBoxProps) {
  const { strings } = useCompany()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)

  return (
    <section className="glass rounded-2xl p-4" aria-label={strings.analytics.askAnything}>
      <h2 className="text-sm font-semibold">{strings.analytics.askAnything}</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {ASK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="rounded-full border border-edge/10 bg-surface px-3 py-1.5 text-xs font-medium"
            onClick={() => setAnswer(answerChip(chip, facts))}
          >
            {chipLabels[chip]}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setAnswer(answerFreeForm(question, facts))
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-xl border border-edge/10 bg-surface px-3 py-2 text-sm"
          placeholder={strings.analytics.askPlaceholder}
          aria-label={strings.analytics.askField}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" className="raised tap-scale rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 py-2 text-sm font-semibold text-white">
          {strings.common.next}
        </button>
      </form>

      {answer !== null && (
        <p className="mt-3 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-sm" role="status">
          {sentenceFor(answer, strings, bucketLabels)}
        </p>
      )}
      {answer !== null && answer.kind !== 'unavailable' && (
        <p className="mt-1 text-[11px] opacity-60">{strings.analytics.askOffline}</p>
      )}
    </section>
  )
}

function sentenceFor(
  answer: AskAnswer,
  strings: ReturnType<typeof useCompany>['strings'],
  bucketLabels: Readonly<Record<string, string>>,
): string {
  switch (answer.kind) {
    case 'who_owes_most':
      return `${answer.customerName} — ${formatMoney(answer.amount)}`
    case 'best_seller':
      return `${answer.name} — ${formatMoney(answer.value)}`
    case 'kept_this_month':
      return `${strings.analytics.kept}: ${formatMoney(answer.kept)}`
    case 'how_late':
      return answer.worst === null || answer.amount === null
        ? strings.analytics.nothingLate
        : `${format(strings.analytics.worstBucket, { bucket: bucketLabels[answer.worst] ?? answer.worst })} ${formatMoney(answer.amount)}`
    case 'nothing_recorded':
      return strings.analytics.nothingYetBody
    case 'unavailable':
      return strings.analytics.askUnavailable
  }
}
