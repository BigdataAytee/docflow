/**
 * Recording payments (§G, §L3, §V).
 *
 * The §V clause these hold: "A part payment updates invoice, customer, Home
 * and analytics once; issuing or resharing its receipt never increments
 * income."
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { money } from '../../domain/money/money'
import {
  LedgerError,
  type Payment,
  applyPaymentEvents,
  effectivePayments,
  receivedByCurrency,
  reversalOf,
} from '../../domain/payments/ledger'
import {
  paidSoFar,
  prefillAmount,
  receiptDraftFor,
  recordPayment,
  unallocatedCredit,
} from './record'

const NGN = (m: number) => money('NGN', m)
const TOTAL = NGN(145_000_00)
const INVOICE = 'inv-1'

const record = (over: Partial<Parameters<typeof recordPayment>[0]> = {}) =>
  recordPayment({
    id: 'p1',
    customerId: 'cus_1',
    amount: NGN(50_000_00),
    paidAt: '2026-09-11T10:00:00Z',
    method: 'bank_transfer',
    invoiceId: INVOICE,
    invoiceTotal: TOTAL,
    existingPayments: [],
    ...over,
  })

describe('The sheet prefills to the balance; a smaller amount is a part payment (§G)', () => {
  it('prefills the full outstanding balance', () => {
    expect(prefillAmount(INVOICE, TOTAL, [])).toEqual(TOTAL)
  })

  it('prefills what is left after an earlier part payment', () => {
    const first = record()
    expect(prefillAmount(INVOICE, TOTAL, [first])).toEqual(NGN(95_000_00))
  })

  it('treats a reduced amount as an ordinary payment, not a special case', () => {
    const part = record({ amount: NGN(20_000_00) })
    expect(part.allocations[0]?.amount).toEqual(NGN(20_000_00))
    expect(paidSoFar(INVOICE, TOTAL, [part]).left).toEqual(NGN(125_000_00))
  })
})

describe('"Mark paid" is a payment record, never a flag (§G, Rule #4)', () => {
  it('produces a ledger record with an allocation', () => {
    const payment = record({ amount: TOTAL })
    expect(payment.allocations).toHaveLength(1)
    expect(payment.allocations[0]?.invoiceId).toBe(INVOICE)
    expect(paidSoFar(INVOICE, TOTAL, [payment]).isSettled).toBe(true)
  })

  it('exposes no way to settle an invoice without money moving', () => {
    // There is no markPaid(invoiceId) in this module — settling IS recording.
    const settled = paidSoFar(INVOICE, TOTAL, [])
    expect(settled.isSettled).toBe(false)
    expect(settled.left).toEqual(TOTAL)
  })
})

describe('The paid-so-far bar (§G, §L3)', () => {
  it('gives the three figures behind "₦50,000 paid of ₦145,000 · ₦95,000 left"', () => {
    const bar = paidSoFar(INVOICE, TOTAL, [record()])
    expect(bar.paid).toEqual(NGN(50_000_00))
    expect(bar.total).toEqual(TOTAL)
    expect(bar.left).toEqual(NGN(95_000_00))
    expect(bar.progress).toBeCloseTo(50 / 145, 6)
  })

  it('keeps paid + left equal to the total for any sequence of payments', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5_000_000 }), { maxLength: 8 }),
        (amounts) => {
          let payments: Payment[] = []
          amounts.forEach((amount, i) => {
            const outstanding = prefillAmount(INVOICE, TOTAL, payments)
            if (outstanding.minor === 0) return
            payments = [
              ...payments,
              recordPayment({
                id: `p${i}`,
                customerId: 'cus_1',
                amount: NGN(Math.min(amount, outstanding.minor)),
                paidAt: '2026-09-11T10:00:00Z',
                method: 'cash',
                invoiceId: INVOICE,
                invoiceTotal: TOTAL,
                existingPayments: payments,
              }),
            ]
          })
          const bar = paidSoFar(INVOICE, TOTAL, payments)
          expect(bar.paid.minor + bar.left.minor).toBe(TOTAL.minor)
        },
      ),
    )
  })
})

describe('Over-payment is customer credit, not a bigger allocation (§K)', () => {
  it('allocates only what the invoice owed and leaves the rest unattached', () => {
    const payment = record({ amount: NGN(200_000_00) })
    expect(payment.allocations[0]?.amount).toEqual(TOTAL)
    expect(unallocatedCredit(payment)).toEqual(NGN(55_000_00))
    expect(paidSoFar(INVOICE, TOTAL, [payment]).left).toEqual(NGN(0))
  })

  it('lets a payment stand alone with no invoice at all (§G)', () => {
    const standalone = recordPayment({
      id: 'p9',
      customerId: 'cus_1',
      amount: NGN(10_000_00),
      paidAt: '2026-09-11T10:00:00Z',
      method: 'cash',
    })
    expect(standalone.allocations).toEqual([])
    expect(unallocatedCredit(standalone)).toEqual(NGN(10_000_00))
  })

  it('refuses a payment of nothing', () => {
    expect(() => record({ amount: NGN(0) })).toThrow(LedgerError)
  })

  it('refuses to allocate without a total to allocate against', () => {
    expect(() =>
      recordPayment({
        id: 'p1',
        customerId: 'cus_1',
        amount: NGN(1000),
        paidAt: '2026-09-11T10:00:00Z',
        method: 'cash',
        invoiceId: INVOICE,
      }),
    ).toThrow(LedgerError)
  })
})

describe('A receipt is a view of a payment (§G, §K, §V)', () => {
  it('derives from a payment that already exists', () => {
    const payment = record({ reference: 'GTB/8842' })
    const draft = receiptDraftFor(payment)
    expect(draft).toEqual({
      paymentId: 'p1',
      customerId: 'cus_1',
      amount: NGN(50_000_00),
      paidAt: '2026-09-11T10:00:00Z',
      method: 'bank_transfer',
      reference: 'GTB/8842',
      linkedInvoiceId: INVOICE,
    })
  })

  it('never increments income however many times it is drawn (§V)', () => {
    const payment = record()
    const before = receivedByCurrency([payment], '2026-09-01', '2026-10-01')

    for (let i = 0; i < 5; i++) receiptDraftFor(payment)

    const after = receivedByCurrency([payment], '2026-09-01', '2026-10-01')
    expect(after.get('NGN')).toEqual(before.get('NGN'))
    expect(after.get('NGN')).toEqual(NGN(50_000_00))
  })

  it('has no receipt for a reversal — no money was handed over', () => {
    const reversal = reversalOf(record(), 'p1r', '2026-09-12T00:00:00Z')
    expect(() => receiptDraftFor(reversal)).toThrow(LedgerError)
  })
})

describe('A payment moves the balance exactly once (§V)', () => {
  it('is unchanged by a replayed upload', () => {
    const payment = record({ externalEventId: 'evt_1' })
    const replayed = applyPaymentEvents([payment, payment, { ...payment, id: 'dup' }])
    expect(replayed).toHaveLength(1)
    expect(paidSoFar(INVOICE, TOTAL, replayed).left).toEqual(NGN(95_000_00))
  })

  it('returns the balance in full when the payment is reversed', () => {
    const payment = record()
    const reversal = reversalOf(payment, 'p1r', '2026-09-12T00:00:00Z')
    const effective = effectivePayments([payment, reversal])
    expect(paidSoFar(INVOICE, TOTAL, effective).left).toEqual(TOTAL)
  })
})
