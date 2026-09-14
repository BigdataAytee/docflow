/**
 * The quick chips (§G step 1).
 *
 * The table is a product decision and the arithmetic is a correctness one, so
 * both are pinned here: which chips a type offers, and what a chip resolves to
 * — including the part a native date picker cannot express, that "30 days" on
 * an invoice counts from the ISSUE date rather than from now.
 */

import { describe, expect, it } from 'vitest'

import { DOCUMENT_TYPES } from '../../domain/documents/types'
import { addDays, applyChip, chipsFor, parseIsoDate, toIsoDate } from './dateChips'

describe("§G's per-type chip table", () => {
  it('offers Today on the first field of every type', () => {
    for (const type of DOCUMENT_TYPES) {
      expect(chipsFor(type, 'first')[0], `${type} has no Today chip`).toEqual({
        kind: 'today',
        offset: 0,
      })
    }
  })

  it('gives an invoice 7, 14 and 30 days of credit', () => {
    expect(chipsFor('invoice', 'second').map((chip) => chip.offset)).toEqual([7, 14, 30])
  })

  it('gives a quotation 14 and 30, because a week is not an offer', () => {
    expect(chipsFor('quotation', 'second').map((chip) => chip.offset)).toEqual([14, 30])
  })

  it('offers a receipt yesterday, and no second date at all', () => {
    expect(chipsFor('receipt', 'first').map((chip) => chip.kind)).toEqual(['today', 'yesterday'])
    // Money arriving has no due date; there is nothing for a second field to be.
    expect(chipsFor('receipt', 'second')).toEqual([])
  })

  it('offers a delivery today or tomorrow', () => {
    expect(chipsFor('waybill', 'second').map((chip) => chip.kind)).toEqual(['today', 'tomorrow'])
  })

  it('offers no chip that reaches backwards except a receipt’s yesterday', () => {
    for (const type of DOCUMENT_TYPES) {
      for (const slot of ['first', 'second'] as const) {
        for (const chip of chipsFor(type, slot)) {
          if (chip.offset < 0) expect(`${type}.${chip.kind}`).toBe('receipt.yesterday')
        }
      }
    }
  })
})

describe('What a chip resolves to', () => {
  const today = '2026-09-14'

  it('counts the first field from today', () => {
    expect(applyChip({ kind: 'today', offset: 0 }, 'first', '', today)).toBe(today)
    expect(applyChip({ kind: 'yesterday', offset: -1 }, 'first', '', today)).toBe('2026-09-13')
  })

  it('counts the second field from the ISSUE date, not from now', () => {
    // The whole reason this is not a native picker: an invoice issued on the
    // 1st with 30 days of credit falls due on the 1st of October, whatever
    // day somebody happens to tap the chip.
    expect(applyChip({ kind: 'days', offset: 30 }, 'second', '2026-09-01', today)).toBe('2026-10-01')
  })

  it('falls back to today when the first field is still empty', () => {
    expect(applyChip({ kind: 'days', offset: 7 }, 'second', '', today)).toBe('2026-09-21')
  })
})

describe('Date arithmetic stays in the local calendar', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('crosses a year end', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('crosses February in a leap year', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('reaches backwards across a month start', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('pads single digits, so the string is always sortable', () => {
    expect(toIsoDate(2026, 1, 5)).toBe('2026-01-05')
  })

  it('refuses a well-shaped string that is not a day', () => {
    expect(parseIsoDate('2026-02-31')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('14/09/2026')).toBeNull()
    expect(parseIsoDate(undefined)).toBeNull()
  })

  it('leaves an unparseable value alone rather than inventing one', () => {
    expect(addDays('not a date', 7)).toBe('not a date')
  })
})
