/**
 * "Statement builds a PDF of invoices against payments for ANY period" (§G).
 *
 * So the period is a control, not an assumption. Four chips cover what an
 * owner actually asks for, and two date fields cover the rest — and whatever
 * is chosen is printed on the statement itself, so a shared PDF can never be
 * ambiguous about what it covers.
 *
 * "Everything" is an open start rather than a guessed one: the earliest date
 * the caller can see, which for a statement means the customer's first
 * document. Inventing a start year would put a fictional boundary on a
 * balance brought forward.
 */

import { useCompany } from '../../app/context'
import { shiftMonths } from '../analytics/inOutKept'

export type PeriodPreset = 'this_month' | 'last_3' | 'last_12' | 'everything'

export interface Period {
  readonly from: string
  /** Exclusive, matching every other period in the codebase. */
  readonly to: string
}

/** The earliest ISO date a statement could need, when "everything" is asked. */
export const OPEN_START = '0001-01-01'

export function periodFor(preset: PeriodPreset, today: string): Period {
  const to = shiftMonths(today, 1)
  switch (preset) {
    case 'this_month':
      return { from: shiftMonths(today, 0), to }
    case 'last_3':
      return { from: shiftMonths(today, -2), to }
    case 'last_12':
      return { from: shiftMonths(today, -11), to }
    case 'everything':
      return { from: OPEN_START, to }
  }
}

export interface PeriodPickerProps {
  readonly period: Period
  readonly today: string
  readonly onChange: (period: Period) => void
}

export function PeriodPicker({ period, today, onChange }: PeriodPickerProps) {
  const { strings } = useCompany()

  const presets: { id: PeriodPreset; label: string }[] = [
    { id: 'this_month', label: strings.statements.thisMonth },
    { id: 'last_3', label: strings.statements.last3Months },
    { id: 'last_12', label: strings.statements.last12Months },
    { id: 'everything', label: strings.statements.everything },
  ]

  return (
    <section className="rounded-2xl bg-white/70 p-4" aria-label={strings.statements.pickPeriod}>
      <h2 className="text-sm font-semibold">{strings.statements.pickPeriod}</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((preset) => {
          const candidate = periodFor(preset.id, today)
          const on = candidate.from === period.from && candidate.to === period.to
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={on}
              className={`min-h-tap rounded-full px-3 text-xs font-medium ${
                on ? 'bg-brand text-white' : 'border border-black/10 bg-white'
              }`}
              onClick={() => onChange(candidate)}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <label className="min-w-0 flex-1 text-xs">
          <span className="block font-medium opacity-70">{strings.statements.from}</span>
          <input
            type="date"
            className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
            value={period.from === OPEN_START ? '' : period.from}
            onChange={(event) =>
              onChange({ ...period, from: event.target.value === '' ? OPEN_START : event.target.value })
            }
          />
        </label>
        <label className="min-w-0 flex-1 text-xs">
          <span className="block font-medium opacity-70">{strings.statements.to}</span>
          <input
            type="date"
            className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
            value={period.to}
            onChange={(event) => {
              if (event.target.value !== '') onChange({ ...period, to: event.target.value })
            }}
          />
        </label>
      </div>
    </section>
  )
}
