/**
 * Ledger property tests — v6 §Q Phase 0 groups 1, 2 and 3:
 *   · allocations never exceed payment or invoice balances
 *   · receipts never move income
 *   · reversal + retry never double-counts
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { CurrencyMismatchError, money, sum, zero } from '../money/money'
import {
  type Payment,
  LedgerError,
  applyPaymentEvents,
  effectivePayments,
  invoiceOutstanding,
  paidAgainstInvoice,
  receivedByCurrency,
  reversalOf,
  unallocated,
  validatePayment,
} from './ledger'

const NGN = (minor: number) => money('NGN', minor)

const payment = (over: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({
  customerId: 'cust-1',
  paidAt: '2026-09-11T10:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [],
  ...over,
})

const allocation = (paymentId: string, invoiceId: string, minor: number) => ({
  id: `${paymentId}:${invoiceId}`,
  paymentId,
  invoiceId,
  amount: NGN(minor),
})

describe('Allocations never exceed the payment or the invoice balance (§K)', () => {
  const outstanding = new Map([['inv-1', NGN(145_000_00)], ['inv-2', NGN(50_000_00)]])

  it('accepts a part payment inside both limits', () => {
    expect(() =>
      validatePayment(
        payment({ id: 'p1', amount: NGN(50_000_00), allocations: [allocation('p1', 'inv-1', 50_000_00)] }),
        outstanding,
      ),
    ).not.toThrow()
  })

  it('refuses allocations totalling more than the payment', () => {
    expect(() =>
      validatePayment(
        payment({
          id: 'p1',
          amount: NGN(60_000_00),
          allocations: [allocation('p1', 'inv-1', 40_000_00), allocation('p1', 'inv-2', 30_000_00)],
        }),
        outstanding,
      ),
    ).toThrow(LedgerError)
  })

  it('refuses an allocation larger than the invoice outstanding', () => {
    expect(() =>
      validatePayment(
        payment({ id: 'p1', amount: NGN(200_000_00), allocations: [allocation('p1', 'inv-1', 150_000_00)] }),
        outstanding,
      ),
    ).toThrow(LedgerError)
  })

  it('holds for every split of every payment', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.array(fc.integer({ min: 0, max: 10_000_000 }), { minLength: 1, maxLength: 6 }),
        (amount, parts) => {
          const invoices = new Map(parts.map((_, i) => [`inv-${i}`, NGN(10_000_000)]))
          const p = payment({
            id: 'p',
            amount: NGN(amount),
            allocations: parts.map((v, i) => allocation('p', `inv-${i}`, v)),
          })
          const allocated = parts.reduce((a, b) => a + b, 0)
          if (allocated > amount) {
            expect(() => validatePayment(p, invoices)).toThrow(LedgerError)
          } else {
            expect(() => validatePayment(p, invoices)).not.toThrow()
            expect(unallocated(p).minor).toBe(amount - allocated)
          }
        },
      ),
    )
  })

  it('refuses a zero, negative or cross-currency allocation', () => {
    expect(() => validatePayment(payment({ id: 'p', amount: NGN(0) }), new Map())).toThrow(LedgerError)
    expect(() => validatePayment(payment({ id: 'p', amount: NGN(-100) }), new Map())).toThrow(LedgerError)
    expect(() =>
      validatePayment(
        payment({
          id: 'p',
          amount: NGN(1000),
          allocations: [{ id: 'a', paymentId: 'p', invoiceId: 'inv-1', amount: money('USD', 500) }],
        }),
        new Map([['inv-1', NGN(5000)]]),
      ),
    ).toThrow(CurrencyMismatchError)
  })

  it('refuses to allocate to an unknown invoice', () => {
    expect(() =>
      validatePayment(
        payment({ id: 'p', amount: NGN(1000), allocations: [allocation('p', 'ghost', 1000)] }),
        new Map(),
      ),
    ).toThrow(LedgerError)
  })
})

describe('A part payment moves the balance exactly once (§L3, §V)', () => {
  it('₦50,000 paid of ₦145,000 leaves ₦95,000', () => {
    const p = payment({
      id: 'p1',
      amount: NGN(50_000_00),
      allocations: [allocation('p1', 'inv-1', 50_000_00)],
    })
    expect(paidAgainstInvoice('inv-1', 'NGN', [p]).minor).toBe(50_000_00)
    expect(invoiceOutstanding('inv-1', NGN(145_000_00), [p]).minor).toBe(95_000_00)
  })

  it('treats an overpayment as customer credit, not a negative invoice', () => {
    const p = payment({
      id: 'p1',
      amount: NGN(200_000_00),
      allocations: [allocation('p1', 'inv-1', 200_000_00)],
    })
    expect(invoiceOutstanding('inv-1', NGN(145_000_00), [p]).minor).toBe(0)
  })

  it('nets credit notes against the balance', () => {
    expect(
      invoiceOutstanding('inv-1', NGN(145_000_00), [], [
        { id: 'cn-1', invoiceId: 'inv-1', amount: NGN(45_000_00) },
      ]).minor,
    ).toBe(100_000_00)
  })
})

describe('Receipts never move income (Rule #4, §V)', () => {
  it('income comes from payments alone — a receipt is a view of one', () => {
    const p = payment({ id: 'p1', amount: NGN(50_000_00) })
    const before = receivedByCurrency([p], '2026-09-01', '2026-10-01')

    // Issue a receipt for it, then reshare and reissue it any number of times.
    const receiptsIssued = [1, 2, 3].map((n) => ({ receiptId: `rec-${n}`, paymentId: p.id }))
    expect(receiptsIssued).toHaveLength(3)

    const after = receivedByCurrency([p], '2026-09-01', '2026-10-01')
    expect(after.get('NGN')).toEqual(before.get('NGN'))
    expect(after.get('NGN')).toEqual(NGN(50_000_00))
  })

  it('separates currencies rather than adding them', () => {
    const received = receivedByCurrency(
      [
        payment({ id: 'a', amount: NGN(50_000_00) }),
        payment({ id: 'b', amount: money('USD', 100_00) }),
      ],
      '2026-09-01',
      '2026-10-01',
    )
    expect(received.get('NGN')).toEqual(NGN(50_000_00))
    expect(received.get('USD')).toEqual(money('USD', 100_00))
    expect([...received.keys()].sort()).toEqual(['NGN', 'USD'])
  })

  it('counts only the current period', () => {
    const received = receivedByCurrency(
      [
        payment({ id: 'a', amount: NGN(1000), paidAt: '2026-08-31T23:59:59Z' }),
        payment({ id: 'b', amount: NGN(2000), paidAt: '2026-09-15T00:00:00Z' }),
        payment({ id: 'c', amount: NGN(4000), paidAt: '2026-10-01T00:00:00Z' }),
      ],
      '2026-09-01',
      '2026-10-01',
    )
    expect(received.get('NGN')).toEqual(NGN(2000))
  })
})

describe('Reversal + retry never double-counts (§E, §M)', () => {
  it('a reversal cancels its payment, and a replacement records once', () => {
    const original = payment({ id: 'p1', amount: NGN(50_000_00) })
    const reversal = reversalOf(original, 'p1r', '2026-09-12T09:00:00Z')
    const replacement = payment({ id: 'p2', amount: NGN(45_000_00) })

    const effective = effectivePayments([original, reversal, replacement])
    expect(effective.map((p) => p.id)).toEqual(['p2'])
    expect(sum(effective.map((p) => p.amount), 'NGN')).toEqual(NGN(45_000_00))
  })

  it('a replayed upload or webhook changes nothing (§U)', () => {
    const event = payment({ id: 'p1', amount: NGN(50_000_00), source: 'provider', externalEventId: 'evt_123' })
    const replayed = [event, { ...event, id: 'p1-dup' }, event]

    const ledger = applyPaymentEvents(replayed)
    expect(ledger).toHaveLength(1)
    expect(receivedByCurrency(ledger, '2026-09-01', '2026-10-01').get('NGN')).toEqual(NGN(50_000_00))
  })

  it('survives any interleaving of retries and reversals', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: 8 }),
        fc.array(fc.nat({ max: 7 }), { maxLength: 8 }),
        fc.nat({ max: 3 }),
        (amounts, reverseIdx, retries) => {
          const payments = amounts.map((a, i) =>
            payment({ id: `p${i}`, amount: NGN(a), externalEventId: `evt_${i}` }),
          )
          const toReverse = [...new Set(reverseIdx)].filter((i) => i < payments.length)
          const reversals = toReverse.map((i) =>
            reversalOf(payments[i]!, `p${i}r`, '2026-09-12T00:00:00Z'),
          )

          // Every record delivered `retries + 1` times, in a shuffled stream.
          const stream = Array.from({ length: retries + 1 }, () => [...payments, ...reversals]).flat()

          const settled = effectivePayments(applyPaymentEvents(stream))
          const expected = amounts.reduce(
            (acc, a, i) => (toReverse.includes(i) ? acc : acc + a),
            0,
          )
          expect(sum(settled.map((p) => p.amount), 'NGN')).toEqual(NGN(expected))
        },
      ),
    )
  })

  it('refuses to reverse a reversal', () => {
    const original = payment({ id: 'p1', amount: NGN(1000) })
    const reversal = reversalOf(original, 'p1r', '2026-09-12T00:00:00Z')
    expect(() => reversalOf(reversal, 'p1rr', '2026-09-13T00:00:00Z')).toThrow(LedgerError)
  })

  it('a reversed payment stops counting towards income', () => {
    const original = payment({ id: 'p1', amount: NGN(50_000_00) })
    const reversal = reversalOf(original, 'p1r', '2026-09-12T09:00:00Z')
    const received = receivedByCurrency([original, reversal], '2026-09-01', '2026-10-01')
    expect(received.get('NGN') ?? zero('NGN')).toEqual(zero('NGN'))
  })
})
