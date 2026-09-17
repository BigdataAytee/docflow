/**
 * Dates as a person reads them (§D, §I).
 *
 * A quotation went out with `Issue Date: 2026-09-04T00:00:00.000Z` printed on
 * it. That is a machine's value on a document sent to a customer, and it is
 * the §S failure in its purest form — the internal representation reaching the
 * page untouched because nothing ever stood between the two.
 *
 * TWO RULES, and the second is the one that bites.
 *
 * ONE — the ORDER comes from the region (§D: the country settles the date
 * format), so this takes the profile's `dateFormat` rather than deciding for
 * itself.
 *
 * TWO — THE CALENDAR DATE IS READ FROM THE STRING, NEVER THROUGH A `Date`.
 * `new Date('2026-09-04T00:00:00.000Z')` is midnight UTC, which is 4 Sep in
 * Lagos and 3 Sep in Los Angeles: formatting it through the local timezone
 * moves an issue date by a day for anybody west of Greenwich. An issue date is
 * a calendar day, not an instant — §L4 makes the same point about schedules —
 * so the year, month and day are taken from the text and nothing is ever
 * converted.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** Whatever shape a stored date arrives in, reduced to its calendar parts. */
export interface CalendarDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

/**
 * Reads `YYYY-MM-DD`, with or without a time after it.
 *
 * Returns null rather than guessing: a value this cannot read is a bug
 * upstream, and inventing a date for it would put a confident wrong day on an
 * invoice instead of an obvious wrong one.
 */
export function calendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (match === null) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/**
 * The date as it should appear on a document.
 *
 * `4 Sep 2026` where the region writes the day first, `Sep 4, 2026` where it
 * writes the month first. The month is a NAME rather than a number on purpose:
 * `04/09/2026` and `09/04/2026` are the same nine characters meaning different
 * days, and a customer abroad has no way to tell which convention produced the
 * one in front of them.
 *
 * An unreadable value comes back unchanged rather than blank — a wrong date a
 * person can see and report beats an empty space they cannot.
 */
export function formatDocumentDate(value: string, dateFormat = 'DD/MM/YYYY'): string {
  const parsed = calendarDate(value)
  if (parsed === null) return value

  const month = MONTHS[parsed.month - 1] ?? String(parsed.month)
  return dateFormat.startsWith('MM')
    ? `${month} ${parsed.day}, ${parsed.year}`
    : `${parsed.day} ${month} ${parsed.year}`
}

/** True when a value would print as a machine's timestamp rather than a date. */
export const looksLikeTimestamp = (value: string): boolean =>
  /\d{4}-\d{2}-\d{2}T/.test(value) || value.includes('GMT') || value.includes('Z')
