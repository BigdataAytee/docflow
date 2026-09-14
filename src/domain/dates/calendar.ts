/**
 * Calendar days, in the calendar the user is actually in.
 *
 * **An INSTANT and a DAY are different things, and this app had been treating
 * them as the same one.** A payment happens at an instant, which is properly
 * stored in UTC and is the same moment everywhere on Earth. A document is
 * dated a DAY — the day the person writing it would say out loud — and which
 * day an instant falls on depends on where you are standing.
 *
 * The idiom that conflated them was everywhere:
 *
 *     new Date().toISOString().slice(0, 10)
 *
 * That is today in UTC. In Lagos (UTC+1) the first hour of every morning
 * reports yesterday; in Lagos it is mild. In New York (UTC-4) the last five
 * hours of every evening report TOMORROW — so an invoice due today reads as
 * overdue from about seven in the evening, every evening, and "received this
 * month" moves a payment made on the 31st into next month. Those are money
 * questions with wrong answers, not formatting.
 *
 * So: every calendar day in the app comes from here, and the rule is one
 * sentence — **a day is read with the local getters, an instant is stored in
 * UTC, and `localDay` is the only place the two ever meet.**
 *
 * Dates are plain `YYYY-MM-DD` strings rather than `Date` objects, because a
 * string is unambiguous: it sorts, it compares, it survives JSON, and it
 * cannot silently carry a time zone into a comparison.
 */

export class CalendarError extends Error {}

/** `YYYY-MM-DD`. A day, not an instant. */
export type IsoDay = string

const pad = (n: number): string => String(n).padStart(2, '0')

/** Build a day from local calendar fields. */
export const toIsoDay = (year: number, month: number, day: number): IsoDay =>
  `${year}-${pad(month)}-${pad(day)}`

/**
 * Split a `YYYY-MM-DD`. Returns null for anything that is not one — including
 * a well-shaped string that is not a real day, like `2026-02-31`.
 */
export function parseIsoDay(value: string | undefined): { y: number; m: number; d: number } | null {
  if (value === undefined) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return null

  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const probe = new Date(y, m - 1, d)
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return null

  return { y, m, d }
}

/**
 * Today, as the person holding the phone would write it.
 *
 * `now` is injectable so every caller can be tested at a fixed date without
 * faking the clock globally.
 */
export const todayIso = (now: Date = new Date()): IsoDay =>
  toIsoDay(now.getFullYear(), now.getMonth() + 1, now.getDate())

/**
 * The local calendar day an instant falls on.
 *
 * The one place an instant becomes a day. A bare `YYYY-MM-DD` is returned
 * untouched, and that guard is load-bearing rather than defensive:
 * `new Date('2026-09-14')` is midnight **UTC**, so reading local fields off it
 * west of Greenwich yields the 13th. Converting a day that is already a day is
 * how this class of bug gets reintroduced by someone being careful.
 */
export function localDay(at: string): IsoDay {
  if (at.length === 10 && parseIsoDay(at) !== null) return at

  const date = new Date(at)
  if (Number.isNaN(date.getTime())) throw new CalendarError(`Not a date: ${at}`)
  return toIsoDay(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/**
 * Add days, staying in the local calendar.
 *
 * Built with `new Date(y, m - 1, d)` — the LOCAL constructor — so month ends,
 * year ends and leap days all come out right without touching UTC.
 */
export function addDays(day: IsoDay, days: number): IsoDay {
  const parts = parseIsoDay(day)
  if (parts === null) return day

  const date = new Date(parts.y, parts.m - 1, parts.d)
  date.setDate(date.getDate() + days)
  return toIsoDay(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** The first day of the calendar month containing `day`. */
export function monthStart(day: IsoDay): IsoDay {
  const parts = parseIsoDay(localDay(day))
  if (parts === null) throw new CalendarError(`Not a date: ${day}`)
  return toIsoDay(parts.y, parts.m, 1)
}

/** The first day of the month after the one containing `day`. */
export function nextMonthStart(day: IsoDay): IsoDay {
  const parts = parseIsoDay(localDay(day))
  if (parts === null) throw new CalendarError(`Not a date: ${day}`)
  return parts.m === 12 ? toIsoDay(parts.y + 1, 1, 1) : toIsoDay(parts.y, parts.m + 1, 1)
}

/** Days in the month `YYYY-MM`. Pure arithmetic — no time zone involved. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}
