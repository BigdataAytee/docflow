/**
 * The Repeat toggle (§L4), built like §G's logo switch: a visible pip state,
 * `aria-pressed`, and a hint line that matches the state rather than
 * describing the control.
 *
 * It never says a draft was created. It says when the next one is due, which
 * is the thing the owner can check against reality.
 */

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import type { Recurrence } from './schedule'
import { nextPeriod } from './schedule'

export interface RepeatToggleProps {
  readonly recurrence: Recurrence | null
  readonly today: string
  /** Drafts this schedule has produced that nobody has opened yet. */
  readonly waitingCount?: number
  readonly onStart: () => void
  readonly onStop: () => void
}

export function RepeatToggle({
  recurrence,
  today,
  waitingCount = 0,
  onStart,
  onStop,
}: RepeatToggleProps) {
  const { strings } = useCompany()
  const r = strings.recurring

  const on = recurrence !== null && recurrence.endedOn === undefined
  const next = recurrence === null ? null : nextPeriod(recurrence, today)

  return (
    <section className="rounded-2xl bg-white/70 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{r.repeat}</p>
          <p className="mt-0.5 text-xs opacity-70">{on ? r.repeatHint : r.repeatOffHint}</p>
        </div>
        <button
          type="button"
          aria-pressed={on}
          aria-label={on ? r.repeatOn : r.repeatOff}
          className={`flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition ${
            on ? 'justify-end bg-emerald-500' : 'justify-start bg-black/20'
          }`}
          onClick={on ? onStop : onStart}
        >
          <span className="h-5 w-5 rounded-full bg-white" />
        </button>
      </div>

      {on && recurrence !== null && (
        <dl className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="opacity-70">{format(r.everyMonth, { day: recurrence.dayOfMonth })}</dt>
            {next !== null && <dd className="tabular-nums">{format(r.nextOn, { date: next })}</dd>}
          </div>
          {waitingCount > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="opacity-70">{format(r.draftsWaiting, { count: waitingCount })}</dt>
              <dd className="opacity-70">{r.reviewBeforeSending}</dd>
            </div>
          )}
        </dl>
      )}

      {on && (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-rose-600"
          onClick={onStop}
        >
          {r.stopRepeating}
        </button>
      )}
    </section>
  )
}
