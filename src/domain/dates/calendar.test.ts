/**
 * Calendar days, in the calendar the user is actually in.
 *
 * These tests are written against the bug they exist to stop coming back: the
 * app derived calendar days from `toISOString()`, which is UTC, and then used
 * them to answer money questions — is this invoice overdue, did this payment
 * land this month.
 *
 * The test process runs in ONE zone, so a test cannot prove behaviour in
 * another one by wishing. What it can do — and what these do — is pin the
 * property that makes the zone irrelevant: a day comes from the local
 * getters, and a local-getter reading of a `Date` never disagrees with the
 * wall clock that constructed it. The UTC version fails that at some hour in
 * every zone but one.
 */

import { describe, expect, it } from 'vitest'

import {
  CalendarError,
  addDays,
  daysInMonth,
  localDay,
  monthStart,
  nextMonthStart,
  parseIsoDay,
  todayIso,
  toIsoDay,
} from './calendar'

describe('Today is the wall clock’s today', () => {
  it('reads the last half-hour of a day as that day', () => {
    // 23:30 on the 14th. `toISOString()` says the 14th or the 15th depending
    // on the offset; the wall clock says the 14th everywhere.
    expect(todayIso(new Date(2026, 8, 14, 23, 30))).toBe('2026-09-14')
  })

  it('reads the first minutes of a day as that day', () => {
    expect(todayIso(new Date(2026, 8, 14, 0, 5))).toBe('2026-09-14')
  })

  it('agrees with the local fields at every hour of a day', () => {
    // The property, stated directly: whatever the zone, the day this returns
    // is the day the Date was built with. `toISOString().slice(0,10)` breaks
    // this for some range of hours in every zone except UTC itself.
    for (let hour = 0; hour < 24; hour += 1) {
      const at = new Date(2026, 8, 14, hour, 30)
      expect(todayIso(at), `hour ${hour}`).toBe('2026-09-14')
    }
  })

  it('does not drift across a month end', () => {
    expect(todayIso(new Date(2026, 8, 30, 23, 59))).toBe('2026-09-30')
    expect(todayIso(new Date(2026, 9, 1, 0, 1))).toBe('2026-10-01')
  })
})

describe('An instant becomes the day it fell on locally', () => {
  it('converts a timestamp with the local getters', () => {
    const at = new Date(2026, 8, 14, 20, 0)
    expect(localDay(at.toISOString())).toBe('2026-09-14')
  })

  it('leaves a bare day alone', () => {
    // Load-bearing. `new Date('2026-09-14')` is midnight UTC, so reading
    // local fields off it gives the 13th west of Greenwich — converting a
    // day that is already a day is how this bug gets reintroduced.
    expect(localDay('2026-09-14')).toBe('2026-09-14')
  })

  it('refuses something that is not a date at all', () => {
    expect(() => localDay('last Tuesday')).toThrow(CalendarError)
  })
})

describe('Month boundaries belong to the company’s calendar', () => {
  it('starts and ends the month a day sits in', () => {
    expect(monthStart('2026-12-15')).toBe('2026-12-01')
    expect(nextMonthStart('2026-12-15')).toBe('2027-01-01')
  })

  it('rolls the year over at December', () => {
    expect(nextMonthStart('2026-12-31')).toBe('2027-01-01')
  })

  it('accepts an instant and reads it locally', () => {
    const at = new Date(2026, 11, 31, 22, 0)
    expect(monthStart(at.toISOString())).toBe('2026-12-01')
    expect(nextMonthStart(at.toISOString())).toBe('2027-01-01')
  })

  it('brackets every day of a month it contains', () => {
    const from = monthStart('2026-02-14')
    const to = nextMonthStart('2026-02-14')
    for (const day of ['2026-02-01', '2026-02-14', '2026-02-28']) {
      expect(day >= from && day < to, day).toBe(true)
    }
    for (const day of ['2026-01-31', '2026-03-01']) {
      expect(day >= from && day < to, day).toBe(false)
    }
  })
})

describe('Arithmetic stays in the local calendar', () => {
  it('crosses month, year and leap boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('pads, so the string always sorts as a date', () => {
    expect(toIsoDay(2026, 1, 5)).toBe('2026-01-05')
  })

  it('refuses a well-shaped string that is not a day', () => {
    expect(parseIsoDay('2026-02-31')).toBeNull()
    expect(parseIsoDay('2026-13-01')).toBeNull()
    expect(parseIsoDay('14/09/2026')).toBeNull()
    expect(parseIsoDay(undefined)).toBeNull()
  })

  it('counts the days in a month, leap years included', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 9)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })
})
