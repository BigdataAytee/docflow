/**
 * The timestamp that reached a customer (§D, §I, §S).
 *
 * A quotation printed `Issue Date: 2026-09-04T00:00:00.000Z`. Nothing stood
 * between the stored value and the page, so the machine's representation was
 * what the customer read.
 */

import { describe, expect, it } from 'vitest'

import { calendarDate, formatDocumentDate, looksLikeTimestamp } from './dates'

describe('A stored date prints as a date', () => {
  /** THE ONE THIS EXISTS FOR — the exact string off the reference document. */
  it('renders the timestamp that shipped as a readable date', () => {
    expect(formatDocumentDate('2026-09-04T00:00:00.000Z')).toBe('4 Sep 2026')
  })

  it.each([
    ['2026-09-04', '4 Sep 2026'],
    ['2026-01-01', '1 Jan 2026'],
    ['2026-12-31', '31 Dec 2026'],
    ['2026-09-04T23:59:59.999Z', '4 Sep 2026'],
    ['2026-09-04T00:00:00+01:00', '4 Sep 2026'],
  ])('renders %s as %s', (input, expected) => {
    expect(formatDocumentDate(input)).toBe(expected)
  })

  /**
   * THE TIMEZONE TRAP, and the reason this never touches `Date`.
   *
   * `new Date('2026-09-04T00:00:00.000Z')` is midnight UTC — 4 Sep in Lagos,
   * 3 SEP in Los Angeles. Formatting through the local zone moves an issue
   * date by a day for everybody west of Greenwich, which on an invoice is a
   * different payment term and on a waybill a different delivery day.
   */
  it('never moves the day, whatever the machine’s timezone is', () => {
    const saved = process.env.TZ
    for (const zone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Africa/Lagos']) {
      process.env.TZ = zone
      expect(formatDocumentDate('2026-09-04T00:00:00.000Z'), zone).toBe('4 Sep 2026')
    }
    process.env.TZ = saved
  })

  /**
   * The month is a NAME, never a number. `04/09/2026` and `09/04/2026` are the
   * same nine characters meaning different days, and a customer abroad cannot
   * tell which convention produced the one in front of them.
   */
  it('writes the month as a name, in the order the region uses', () => {
    expect(formatDocumentDate('2026-09-04', 'DD/MM/YYYY')).toBe('4 Sep 2026')
    expect(formatDocumentDate('2026-09-04', 'MM/DD/YYYY')).toBe('Sep 4, 2026')
    for (const format of ['DD/MM/YYYY', 'MM/DD/YYYY']) {
      expect(formatDocumentDate('2026-09-04', format)).not.toMatch(/^\d+\/\d+/)
    }
  })

  /** A wrong date somebody can see beats an empty space they cannot. */
  it.each(['', 'not a date', '04/09/2026', '2026-13-45'])(
    'returns %p unchanged rather than inventing one',
    (bad) => {
      expect(formatDocumentDate(bad)).toBe(bad)
    },
  )

  it('reads the calendar parts without a Date object', () => {
    expect(calendarDate('2026-09-04T00:00:00.000Z')).toEqual({ year: 2026, month: 9, day: 4 })
    expect(calendarDate('nope')).toBeNull()
  })
})

describe('Spotting a machine value before it reaches a page', () => {
  it.each(['2026-09-04T00:00:00.000Z', '2026-09-04T12:00:00Z'])('flags %s', (value) => {
    expect(looksLikeTimestamp(value)).toBe(true)
  })

  it.each(['2026-09-04', '4 Sep 2026'])('leaves %s alone', (value) => {
    expect(looksLikeTimestamp(value)).toBe(false)
  })
})
