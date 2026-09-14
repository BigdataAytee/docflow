/**
 * Home's two stats (§G, §V).
 *
 * Each clause of §G's paragraph is a way the number could be wrong.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { money } from '../../domain/money/money'
import { type Payment, reversalOf } from '../../domain/payments/ledger'
import {
  type StatDocument,
  monthStart,
  needsAttention,
  nextMonthStart,
  outstandingByCurrency,
  receivedThisMonth,
} from './stats'

const NGN = (m: number) => money('NGN', m)
const USD = (m: number) => money('USD', m)

const doc = (over: Partial<StatDocument> & Pick<StatDocument, 'id' | 'type' | 'total'>): StatDocument => ({
  status: 'issued',
  ...over,
})

const payment = (over: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({
  customerId: 'cus_1',
  paidAt: '2026-09-11T10:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [],
  ...over,
})

const allocated = (id: string, invoiceId: string, minor: number) =>
  payment({
    id,
    amount: NGN(minor),
    allocations: [{ id: `${id}:a`, paymentId: id, invoiceId, amount: NGN(minor) }],
  })

describe('Outstanding counts only money actually owed (§G)', () => {
  it('sums the remaining balance on issued invoices', () => {
    const out = outstandingByCurrency(
      [doc({ id: 'i1', type: 'invoice', total: NGN(145_000_00) })],
      [allocated('p1', 'i1', 50_000_00)],
    )
    expect(out.get('NGN')).toEqual(NGN(95_000_00))
  })

  it('ignores drafts and voided invoices', () => {
    const out = outstandingByCurrency(
      [
        doc({ id: 'i1', type: 'invoice', total: NGN(100_00), status: 'draft' }),
        doc({ id: 'i2', type: 'invoice', total: NGN(200_00), status: 'void' }),
        doc({ id: 'i3', type: 'invoice', total: NGN(300_00) }),
      ],
      [],
    )
    expect(out.get('NGN')).toEqual(NGN(300_00))
  })

  it('counts nothing from a quotation or a delivery document (§G)', () => {
    const out = outstandingByCurrency(
      [
        doc({ id: 'q1', type: 'quotation', total: NGN(999_000_00) }),
        doc({ id: 'w1', type: 'waybill', total: NGN(0) }),
      ],
      [],
    )
    expect(out.size).toBe(0)
  })

  it('never counts a receipt as more money owed (§G, §V)', () => {
    // A receipt is evidence of money already received. Counting it here would
    // bill the customer twice for one sale.
    const out = outstandingByCurrency(
      [doc({ id: 'r1', type: 'receipt', total: NGN(50_000_00) })],
      [],
    )
    expect(out.size).toBe(0)
  })

  it('nets credit notes', () => {
    const out = outstandingByCurrency(
      [doc({ id: 'i1', type: 'invoice', total: NGN(145_000_00) })],
      [],
      [{ id: 'cn1', invoiceId: 'i1', amount: NGN(45_000_00) }],
    )
    expect(out.get('NGN')).toEqual(NGN(100_000_00))
  })

  it('keeps NGN and USD apart (§G, §V)', () => {
    const out = outstandingByCurrency(
      [
        doc({ id: 'i1', type: 'invoice', total: NGN(100_000_00) }),
        doc({ id: 'i2', type: 'invoice', total: USD(500_00) }),
      ],
      [],
    )
    expect(out.get('NGN')).toEqual(NGN(100_000_00))
    expect(out.get('USD')).toEqual(USD(500_00))
    expect([...out.keys()].sort()).toEqual(['NGN', 'USD'])
  })

  it('never goes negative, however much was paid', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50_000_000 }), (paid) => {
        const out = outstandingByCurrency(
          [doc({ id: 'i1', type: 'invoice', total: NGN(1_000_000) })],
          paid === 0 ? [] : [allocated('p1', 'i1', Math.min(paid, 1_000_000))],
        )
        expect((out.get('NGN') ?? NGN(0)).minor).toBeGreaterThanOrEqual(0)
      }),
    )
  })
})

describe('Received this month is payments, never receipts (§G, §V)', () => {
  /**
   * Instants built from LOCAL fields at midday.
   *
   * These fixtures used to be written as `'2026-09-30T23:59:59Z'`, and that
   * is the shape of the bug rather than a way to test it: which calendar day
   * such an instant falls on depends on the zone the test happens to run in,
   * so the assertion passed in Greenwich and failed an hour east of it.
   * Midday local is the same calendar day in every zone on Earth, so these
   * tests now assert the rule rather than the runner's offset.
   */
  const middayLocal = (year: number, month: number, day: number): string =>
    new Date(year, month - 1, day, 12, 0, 0).toISOString()

  it('sums effective payments inside the calendar month', () => {
    const received = receivedThisMonth(
      [
        payment({ id: 'p1', amount: NGN(50_000_00), paidAt: middayLocal(2026, 9, 1) }),
        payment({ id: 'p2', amount: NGN(25_000_00), paidAt: middayLocal(2026, 9, 30) }),
      ],
      '2026-09-11',
    )
    expect(received.get('NGN')).toEqual(NGN(75_000_00))
  })

  it('excludes last month and next month', () => {
    const received = receivedThisMonth(
      [
        payment({ id: 'p1', amount: NGN(10_00), paidAt: middayLocal(2026, 8, 31) }),
        payment({ id: 'p2', amount: NGN(20_00), paidAt: middayLocal(2026, 9, 15) }),
        payment({ id: 'p3', amount: NGN(40_00), paidAt: middayLocal(2026, 10, 1) }),
      ],
      '2026-09-11',
    )
    expect(received.get('NGN')).toEqual(NGN(20_00))
  })

  it('puts a late-evening payment in the day the OWNER was having', () => {
    // The bug this replaced: an instant was sliced to its UTC day, so a
    // payment taken at 23:30 on the 30th counted as October for a business
    // east of Greenwich, and one taken at 20:00 on the 1st counted as the
    // previous month for a business west of it. Built from local fields,
    // both of these are unambiguously September wherever this runs.
    const received = receivedThisMonth(
      [
        payment({
          id: 'p1',
          amount: NGN(10_000_00),
          paidAt: new Date(2026, 8, 30, 23, 30).toISOString(),
        }),
        payment({
          id: 'p2',
          amount: NGN(5_000_00),
          paidAt: new Date(2026, 8, 1, 0, 30).toISOString(),
        }),
      ],
      '2026-09-11',
    )
    expect(received.get('NGN')).toEqual(NGN(15_000_00))
  })

  it('drops a reversed payment', () => {
    const original = payment({ id: 'p1', amount: NGN(50_000_00) })
    const received = receivedThisMonth(
      [original, reversalOf(original, 'p1r', '2026-09-12T00:00:00Z')],
      '2026-09-11T12:00:00Z',
    )
    expect(received.get('NGN')).toBeUndefined()
  })

  it('handles a December month boundary', () => {
    expect(monthStart('2026-12-15')).toBe('2026-12-01')
    expect(nextMonthStart('2026-12-15')).toBe('2027-01-01')
  })

  it('keeps currencies apart here too', () => {
    const received = receivedThisMonth(
      [
        payment({ id: 'p1', amount: NGN(50_000_00) }),
        payment({ id: 'p2', amount: USD(100_00) }),
      ],
      '2026-09-11T12:00:00Z',
    )
    expect(received.get('NGN')).toEqual(NGN(50_000_00))
    expect(received.get('USD')).toEqual(USD(100_00))
  })
})

describe('Needs attention is short by design (§G)', () => {
  const dueDates = new Map([['i1', '2026-09-01'], ['i2', '2026-09-02'], ['i3', '2026-09-03'], ['i4', '2026-09-04']])

  it('surfaces an overdue invoice with what is still owed', () => {
    const items = needsAttention(
      [doc({ id: 'i1', type: 'invoice', total: NGN(145_000_00) })],
      [allocated('p1', 'i1', 50_000_00)],
      dueDates,
      '2026-09-11',
    )
    expect(items).toEqual([{ documentId: 'i1', kind: 'overdue', amount: NGN(95_000_00) }])
  })

  it('surfaces a delivery in transit', () => {
    const items = needsAttention(
      [doc({ id: 'w1', type: 'waybill', total: NGN(0), status: 'in_transit' })],
      [],
      new Map(),
      '2026-09-11',
    )
    expect(items[0]?.kind).toBe('in_transit')
  })

  it('never lists more than three — a backlog is not attention', () => {
    const many = ['i1', 'i2', 'i3', 'i4'].map((id) =>
      doc({ id, type: 'invoice' as const, total: NGN(1000) }),
    )
    expect(needsAttention(many, [], dueDates, '2026-09-11')).toHaveLength(3)
  })

  it('leaves a settled invoice alone even when its due date passed', () => {
    const items = needsAttention(
      [doc({ id: 'i1', type: 'invoice', total: NGN(1000) })],
      [allocated('p1', 'i1', 1000)],
      dueDates,
      '2026-09-11',
    )
    expect(items).toEqual([])
  })
})
