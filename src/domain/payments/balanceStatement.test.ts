/**
 * The arithmetic a balance invoice is built on (§K, Rule #3).
 *
 * Money, so the properties are checked over generated values rather than a
 * handful of chosen ones: the failures that matter here are the ones nobody
 * would think to write down — a payment larger than the debt, a hundred tiny
 * instalments, an amount one minor unit off settling.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { MoneyError, money, sum } from '../money/money'
import {
  type Deduction,
  balanceDue,
  deductionsFrom,
  restoreDeductions,
  statementAddsUp,
  storedDeductions,
} from './balanceStatement'

const NGN = (minor: number) => money('NGN', minor)
const minor = fc.integer({ min: 0, max: 9_999_999_99 })

describe('What is still owed (§K, Rule #3)', () => {
  it('is the frozen total when nothing has been paid', () => {
    fc.assert(
      fc.property(minor, (total) => {
        expect(balanceDue(NGN(total), []).minor).toBe(total)
      }),
    )
  })

  /** The worked example from the brief, to the naira. */
  it('takes each payment off the frozen total', () => {
    const due = balanceDue(NGN(145_000_00), [
      { paidAt: '2026-09-21', amount: NGN(50_000_00) },
      { paidAt: '2026-09-28', amount: NGN(30_000_00) },
    ])
    expect(due.minor).toBe(65_000_00)
  })

  /**
   * NEVER NEGATIVE. An overpayment is customer credit, not a debt owed the
   * other way — the same rule `invoiceOutstanding` applies, so the two cannot
   * disagree about a settled invoice.
   */
  it('never goes below nothing, however much arrives', () => {
    fc.assert(
      fc.property(minor, minor, (total, paid) => {
        const due = balanceDue(NGN(total), [{ paidAt: '2026-09-21', amount: NGN(paid) }])
        expect(due.minor).toBeGreaterThanOrEqual(0)
        if (paid >= total) expect(due.minor).toBe(0)
      }),
    )
  })

  /**
   * ORDER CANNOT CHANGE THE ANSWER. Integer minor units, so this holds
   * exactly — the property that would fail immediately if any of this were
   * done in floats (Rule #3).
   */
  it('gives the same balance whatever order the payments arrived in', () => {
    fc.assert(
      fc.property(minor, fc.array(minor, { maxLength: 40 }), (total, paid) => {
        const forwards: Deduction[] = paid.map((amount, index) => ({
          paidAt: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
          amount: NGN(amount),
        }))
        const backwards = [...forwards].reverse()
        expect(balanceDue(NGN(total), forwards).minor).toBe(balanceDue(NGN(total), backwards).minor)
      }),
    )
  })

  /**
   * AND MANY SMALL PAYMENTS SETTLE EXACTLY. A hundred instalments that add to
   * the total must leave nothing — not one minor unit, which is what a
   * rounding step anywhere in this chain would produce.
   */
  it('settles to exactly nothing when the instalments add up', () => {
    fc.assert(
      fc.property(fc.array(minor, { minLength: 1, maxLength: 100 }), (parts) => {
        const total = parts.reduce((running, part) => running + part, 0)
        const deductions = parts.map((amount, index) => ({
          paidAt: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
          amount: NGN(amount),
        }))
        expect(balanceDue(NGN(total), deductions).minor).toBe(0)
      }),
    )
  })

  /** One minor unit short is still a debt, and it is one minor unit. */
  it('leaves a single minor unit owing when a payment is one short', () => {
    expect(balanceDue(NGN(145_000_00), [{ paidAt: '2026-09-21', amount: NGN(144_999_99) }]).minor)
      .toBe(1)
  })

  /** Money is never mixed across currencies (Rule #3). */
  it('refuses a payment in another currency', () => {
    expect(() =>
      balanceDue(NGN(145_000_00), [{ paidAt: '2026-09-21', amount: money('GHS', 50_000_00) }]),
    ).toThrow(MoneyError)
  })
})

describe('The items still account for the total (§K)', () => {
  it('agrees when the lines sum to the frozen total', () => {
    expect(statementAddsUp(NGN(145_000_00), sum([NGN(100_000_00), NGN(45_000_00)], 'NGN'))).toBe(
      true,
    )
  })

  /**
   * AND SAYS SO WHEN THEY DO NOT. The frozen total is what the arithmetic
   * runs on, so a mismatch never produces a wrong balance — it produces a
   * document whose visible lines contradict its stated total, which is the
   * thing a customer notices and this is the thing that catches it.
   */
  it('disagrees when a line has drifted', () => {
    expect(statementAddsUp(NGN(145_000_00), sum([NGN(100_000_00), NGN(44_999_99)], 'NGN'))).toBe(
      false,
    )
  })
})

describe('Deductions come off the ledger in the order money arrived (§K)', () => {
  const allocation = (id: string, paidAt: string, amount: number) => ({
    id,
    paidAt,
    amount: NGN(amount),
  })

  it('sorts by the day the money arrived', () => {
    const rows = deductionsFrom(
      [
        allocation('a3', '2026-09-28', 30_000_00),
        allocation('a1', '2026-09-10', 50_000_00),
        allocation('a2', '2026-09-21', 20_000_00),
      ],
      'NGN',
    )
    expect(rows.map((row) => row.paidAt)).toEqual(['2026-09-10', '2026-09-21', '2026-09-28'])
  })

  /**
   * TWO ON ONE DAY KEEP A STABLE ORDER. A document whose lines reorder
   * between two renders is a document that looks edited.
   */
  it('breaks a tie on the same day by id', () => {
    const rows = deductionsFrom(
      [allocation('b', '2026-09-10', 1_00), allocation('a', '2026-09-10', 2_00)],
      'NGN',
    )
    expect(rows.map((row) => row.amount.minor)).toEqual([2_00, 1_00])
  })

  /** Another currency is not this document's money (Rule #3). */
  it('leaves out a payment in another currency', () => {
    const rows = deductionsFrom(
      [allocation('a', '2026-09-10', 1_00), { id: 'b', paidAt: '2026-09-11', amount: money('GHS', 5_00) }],
      'NGN',
    )
    expect(rows).toHaveLength(1)
  })
})

describe('Deductions survive being stored (§M, Rule #3)', () => {
  /**
   * MINOR UNITS BOTH WAYS. The round trip is asserted rather than assumed
   * because this is the boundary where money meets the database, and it is
   * where a float would get in.
   */
  it('round-trips through the record and back', () => {
    fc.assert(
      fc.property(fc.array(minor, { maxLength: 30 }), (parts) => {
        const deductions = parts.map((amount, index) => ({
          paidAt: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
          amount: NGN(amount),
        }))
        const back = restoreDeductions(storedDeductions(deductions), 'NGN')
        expect(back).toEqual(deductions)
        expect(sum(back.map((row) => row.amount), 'NGN').minor).toBe(
          sum(deductions.map((row) => row.amount), 'NGN').minor,
        )
      }),
    )
  })
})
