/**
 * Recurring invoices (§L4, §M, §Q Phase 2.5).
 *
 * The clause worth testing hardest is the one a user never sees working and
 * always sees failing: missed periods created on next launch WITHOUT
 * duplicates.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  CATCH_UP_LIMIT,
  RecurrenceError,
  type Recurrence,
  catchUp,
  daysInMonth,
  dueDay,
  nextPeriod,
  recurrenceKeyFor,
  startRepeating,
  stopRepeating,
} from './schedule'

const every = (over: Partial<Recurrence> = {}): Recurrence => ({
  sourceDocumentId: 'doc_88',
  dayOfMonth: 5,
  startedOn: '2026-06-05',
  ...over,
})

const keysOf = (result: ReturnType<typeof catchUp>) => result.due.map((period) => period.recurrenceKey)

describe('The Repeat toggle (§L4)', () => {
  it('starts from the document being looked at', () => {
    const recurrence = startRepeating('doc_88', '2026-06-05')
    expect(recurrence).toEqual({ sourceDocumentId: 'doc_88', dayOfMonth: 5, startedOn: '2026-06-05' })
  })

  it('does not repeat the month the source document already covers', () => {
    const result = catchUp(every(), '2026-06-20', new Set())
    expect(result.due).toEqual([])
  })

  it('names the next month a draft is coming', () => {
    expect(nextPeriod(every(), '2026-09-11')).toBe('2026-10')
  })

  it('stops producing anything once Repeat is switched off', () => {
    const stopped = stopRepeating(every(), '2026-07-31')
    expect(catchUp(stopped, '2026-12-01', new Set()).due.map((p) => p.month)).toEqual(['2026-07'])
    expect(nextPeriod(stopped, '2026-12-01')).toBeNull()
  })
})

describe('Missed periods, created once (§L4, §M)', () => {
  it('creates a draft for each month the phone was closed', () => {
    const result = catchUp(every(), '2026-09-11', new Set())
    expect(result.due.map((period) => period.month)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(result.due.map((period) => period.issueDate)).toEqual([
      '2026-07-05',
      '2026-08-05',
      '2026-09-05',
    ])
    expect(result.skipped).toEqual([])
  })

  it('creates nothing the second time it runs — the idempotency clause', () => {
    const first = catchUp(every(), '2026-09-11', new Set())
    const created = new Set(keysOf(first))
    const second = catchUp(every(), '2026-09-11', created)
    expect(second.due).toEqual([])
  })

  it('fills only the gap when catch-up was interrupted halfway', () => {
    // A crash after the July draft committed and before August did.
    const partial = new Set([recurrenceKeyFor('doc_88', '2026-07')])
    expect(catchUp(every(), '2026-09-11', partial).due.map((p) => p.month)).toEqual([
      '2026-08',
      '2026-09',
    ])
  })

  it('gives the same key for the same period, whatever creates it', () => {
    expect(recurrenceKeyFor('doc_88', '2026-09')).toBe('rec:doc_88:2026-09')
    // Two devices launching at once derive the same key, so the server's
    // idempotency check collapses them into one draft (§M).
    const deviceA = catchUp(every(), '2026-09-11', new Set())
    const deviceB = catchUp(every(), '2026-09-11', new Set())
    expect(keysOf(deviceA)).toEqual(keysOf(deviceB))
  })

  it('never creates the same period twice, for any gap and any interleaving', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 1, max: 28 }),
        (monthsLater, day) => {
          const recurrence = every({ dayOfMonth: day, startedOn: `2026-01-${String(day).padStart(2, '0')}` })
          const today = `${2026 + Math.floor(monthsLater / 12)}-${String((monthsLater % 12) + 1).padStart(2, '0')}-28`

          const created = new Set<string>()
          // Launch, create, launch again, create again — any number of times.
          for (let launch = 0; launch < 3; launch += 1) {
            for (const period of catchUp(recurrence, today, created).due) {
              if (created.has(period.recurrenceKey)) return false
              created.add(period.recurrenceKey)
            }
          }
          return true
        },
      ),
    )
  })
})

describe('A bounded catch-up says what it skipped (§A: nothing pretends)', () => {
  it('creates the recent months and reports the older ones', () => {
    const recurrence = every({ startedOn: '2020-01-05' })
    const result = catchUp(recurrence, '2026-09-11', new Set())
    expect(result.due).toHaveLength(CATCH_UP_LIMIT)
    expect(result.due[0]?.month).toBe('2025-10')
    expect(result.skipped.length).toBeGreaterThan(0)
    expect(result.skipped[0]).toBe('2020-02')
  })

  it('skips nothing when the gap fits', () => {
    expect(catchUp(every(), '2026-09-11', new Set()).skipped).toEqual([])
  })
})

describe('Short months (§K)', () => {
  it('uses the last day when the month is too short', () => {
    expect(dueDay('2026-02', 31)).toBe('2026-02-28')
    expect(dueDay('2028-02', 31)).toBe('2028-02-29')
    expect(dueDay('2026-04', 31)).toBe('2026-04-30')
    expect(dueDay('2026-01', 31)).toBe('2026-01-31')
  })

  it('knows how long every month is, leap years included', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-12')).toBe(31)
  })

  it('refuses a day no month has', () => {
    expect(() => dueDay('2026-01', 32)).toThrow(RecurrenceError)
    expect(() => dueDay('2026-01', 0)).toThrow(RecurrenceError)
  })

  it('never produces a date outside its own month', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        (month, day) => {
          const label = `2026-${String(month).padStart(2, '0')}`
          const date = dueDay(label, day)
          return date.startsWith(label) && Number(date.slice(8)) <= daysInMonth(label)
        },
      ),
    )
  })
})
