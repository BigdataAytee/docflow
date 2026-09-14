/**
 * The inline calendar (§G step 1).
 *
 * "Tapping opens an inline calendar (month arrows, today ringed, selection
 * filled) with per-type quick chips. Date format follows the locale profile."
 *
 * Inline rather than a native `<input type="date">`, for one reason that is
 * worth the component: the chips. A platform picker cannot offer "30 days",
 * and it certainly cannot know that thirty days means thirty days after the
 * ISSUE date rather than thirty from now. That is the tap-saver §G is after,
 * and it is the most-used field in the app.
 *
 * Month and weekday names come from `Intl`, not from the terminology tables.
 * §D governs what a DOCUMENT is called — the words a business chose and a
 * native speaker signed off. "September" is not one of those; it is in the
 * platform already, in every language the app ships, and copying twelve names
 * four times into a reviewed table would be four more things to get wrong.
 *
 * `Intl` needs no network, so this works in airplane mode like everything
 * else (Rule #2).
 */

import { useMemo, useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { Icon } from '../../ui'
import type { DocumentType } from '../../domain/documents/types'
import {
  applyChip,
  chipsFor,
  parseIsoDate,
  toIsoDate,
  type DateChip,
  type DateSlot,
} from './dateChips'

export interface InlineCalendarProps {
  readonly type: DocumentType
  readonly slot: DateSlot
  /** The selected date, `YYYY-MM-DD`, or empty when none is set yet. */
  readonly value: string
  /** The first field's date — the base the second slot's chips count from. */
  readonly firstDate: string
  /** Today, `YYYY-MM-DD`. Passed in so the component is testable at any date. */
  readonly today: string
  readonly accent: string
  readonly onPick: (value: string) => void
}

/** A locale tag `Intl` will accept. Falls back rather than throwing (§D). */
function intlLocale(locale: string): string {
  try {
    // `Intl` canonicalises case, so "EN-NG" is accepted as-is; the try/catch
    // is for a malformed override reaching this far.
    return Intl.DateTimeFormat.supportedLocalesOf([locale])[0] ?? locale
  } catch {
    return 'en'
  }
}

export function InlineCalendar({
  type,
  slot,
  value,
  firstDate,
  today,
  accent,
  onPick,
}: InlineCalendarProps) {
  const { profile, strings } = useCompany()
  const locale = intlLocale(profile.locale)

  const selected = parseIsoDate(value)
  const todayParts = parseIsoDate(today)

  /**
   * Which month the grid is showing. Starts on the selected date's month, or
   * today's when nothing is chosen — never on a month with nothing in it.
   */
  const [view, setView] = useState(() => {
    const anchor = selected ?? todayParts
    return anchor === null ? { y: 2026, m: 1 } : { y: anchor.y, m: anchor.m }
  })

  const monthName = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(view.y, view.m - 1, 1),
      )
    } catch {
      return `${view.m}/${view.y}`
    }
  }, [locale, view])

  /** Sunday-first initials, in the active language. */
  const weekdays = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
      // 4 Jan 1970 was a Sunday — a fixed anchor, so this does not depend on
      // when the app happens to be running.
      return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(1970, 0, 4 + i)))
    } catch {
      return ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    }
  }, [locale])

  const dayName = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      return (y: number, m: number, d: number) => fmt.format(new Date(y, m - 1, d))
    } catch {
      return (y: number, m: number, d: number) => toIsoDate(y, m, d)
    }
  }, [locale])

  const firstWeekday = new Date(view.y, view.m - 1, 1).getDay()
  const daysInMonth = new Date(view.y, view.m, 0).getDate()

  const moveMonth = (by: number) => {
    const next = new Date(view.y, view.m - 1 + by, 1)
    setView({ y: next.getFullYear(), m: next.getMonth() + 1 })
  }

  const chipLabel = (chip: DateChip): string => {
    switch (chip.kind) {
      case 'today':
        return strings.details.today
      case 'tomorrow':
        return strings.details.tomorrow
      case 'yesterday':
        return strings.details.yesterday
      case 'days':
        return format(strings.details.inDays, { days: chip.offset })
    }
  }

  const chips = chipsFor(type, slot)

  return (
    <div className="glass-solid mt-1.5 rounded-2xl p-2.5" role="group" aria-label={monthName}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label={strings.details.previousMonth}
          className="sunken tap-scale grid h-6 w-6 place-items-center rounded-lg"
        >
          {/* Mirrored in Arabic: "previous" is the way the text came from. */}
          <Icon name="chevron-right" size={0.8} className="flip-rtl rotate-180" />
        </button>
        {/*
          `aria-live`: changing month is the one thing here that alters the
          grid without moving focus, so without this a reader hears the new
          dates with no idea which month they belong to.
        */}
        <p className="text-[11px] font-semibold" aria-live="polite">
          {monthName}
        </p>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label={strings.details.nextMonth}
          className="sunken tap-scale grid h-6 w-6 place-items-center rounded-lg"
        >
          <Icon name="chevron-right" size={0.8} className="flip-rtl" />
        </button>
      </div>

      <div aria-hidden="true" className="grid grid-cols-7 gap-0.5">
        {weekdays.map((day, index) => (
          <span key={index} className="py-0.5 text-center text-[8.5px] font-semibold opacity-45">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {/*
          Leading blanks, not the previous month's numbers. The prototype greys
          those in and disables them; a disabled button that shows a date is
          something a reader still stops on, and it can never be chosen.
        */}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`lead-${i}`} aria-hidden="true" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const iso = toIsoDate(view.y, view.m, day)
          const isSelected = value === iso
          const isToday = today === iso

          return (
            <button
              key={day}
              type="button"
              onClick={() => onPick(iso)}
              // The full date, not the bare number: "14" read aloud in a grid
              // of forty-two numbers says nothing a person can act on.
              aria-label={dayName(view.y, view.m, day)}
              aria-pressed={isSelected}
              className="tap-scale grid aspect-square min-h-tap place-items-center rounded-[9px] text-[10.5px]"
              style={
                isSelected
                  ? {
                      backgroundImage: `linear-gradient(160deg, ${accent}, ${accent})`,
                      color: '#fff',
                      fontWeight: 600,
                      boxShadow: `0 3px 8px ${accent}59`,
                    }
                  : isToday
                    ? {
                        // Ringed, not filled — today is a landmark, not a choice.
                        boxShadow: 'inset 0 0 0 1.5px var(--step-pending-bar)',
                        fontWeight: 600,
                      }
                    : undefined
              }
            >
              {day}
            </button>
          )
        })}
      </div>

      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 border-t border-edge/10 pt-1.5">
          {chips.map((chip) => (
            <button
              key={`${chip.kind}-${chip.offset}`}
              type="button"
              onClick={() => onPick(applyChip(chip, slot, firstDate, today))}
              className="tap-scale rounded-full px-2.5 py-1.5 text-[10px] font-semibold"
              style={{
                backgroundImage: 'linear-gradient(180deg, #fff, var(--field-image-end, #f2f5fd))',
                color: accent,
                boxShadow: `0 2px 5px ${accent}1f, inset 0 1px 0 #fff`,
              }}
            >
              {chipLabel(chip)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
