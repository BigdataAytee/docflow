/**
 * Receipts as evidence of payments (§G, §K, §V).
 *
 * §G: "A receipt is evidence of a payment: starting one from Home records a
 * payment first, optionally linked to an invoice or standing alone, never
 * inventing a duplicate invoice. Originals are never altered; links persist."
 *
 * These hold each clause of that sentence, plus the one it implies: money
 * cannot move twice for one gesture (§M).
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { money } from '../../domain/money/money'
import { LedgerError, type Payment, reversalOf } from '../../domain/payments/ledger'
import { recordPayment } from './record'
import {
  ReceiptFlowError,
  type ReceiptCandidate,
  paymentsAwaitingReceipt,
  receiptFor,
  receiptForPayment,
  receiptKeyFor,
  receiptRecordFor,
  settleableInvoices,
  startReceipt,
} from './receiptFlow'

const NGN = (m: number) => money('NGN', m)
const USD = (m: number) => money('USD', m)

const payment = (over: Partial<Parameters<typeof recordPayment>[0]> = {}): Payment =>
  recordPayment({
    id: 'pay_1',
    customerId: 'cus_1',
    amount: NGN(50_000_00),
    paidAt: '2026-09-11T10:00:00Z',
    method: 'bank_transfer',
    ...over,
  })

const receipt = (over: Partial<ReceiptCandidate> = {}): ReceiptCandidate => ({
  id: 'doc_rct',
  type: 'receipt',
  status: 'issued',
  paymentId: 'pay_1',
  ...over,
})

describe('The payment comes first, always (§G, §V)', () => {
  it('records the payment and derives the draft from what it recorded', () => {
    const started = startReceipt({
      paymentId: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(50_000_00),
      paidAt: '2026-09-11T10:00:00Z',
      method: 'bank_transfer',
      reference: 'GTB/8842',
    })

    expect(started.payment.amount).toEqual(NGN(50_000_00))
    expect(started.draft.paymentId).toBe('pay_1')
    expect(started.draft.amount).toEqual(started.payment.amount)
    expect(started.draft.reference).toBe('GTB/8842')
  })

  it('offers no way to reach a draft without a payment behind it', () => {
    // `receiptFor` is the only other door in, and it needs the payment to
    // exist. There is no function here taking an amount and returning a draft.
    expect(() => receiptFor([], 'pay_missing')).toThrow(ReceiptFlowError)
    expect(() => receiptFor([], 'pay_missing')).toThrow(/pay_missing/)
  })

  it('carries a token rather than a sentence, so the words stay in the catalogue', () => {
    try {
      receiptFor([], 'pay_missing')
      expect.unreachable()
    } catch (cause) {
      expect(cause).toBeInstanceOf(ReceiptFlowError)
      expect((cause as ReceiptFlowError).field).toBe('no_such_payment')
    }
  })

  it('refuses an amount of nothing before any record is written', () => {
    expect(() =>
      startReceipt({
        paymentId: 'pay_1',
        customerId: 'cus_1',
        amount: NGN(0),
        paidAt: '2026-09-11T10:00:00Z',
        method: 'cash',
      }),
    ).toThrow(ReceiptFlowError)
  })

  it('has nothing to acknowledge for a reversal', () => {
    expect(() => receiptFor([reversalOf(payment(), 'pay_1r', '2026-09-12T00:00:00Z')], 'pay_1r'))
      .toThrow(LedgerError)
  })
})

describe('Standing alone means no allocation, never an invented invoice (§G, §K)', () => {
  it('leaves the money unallocated when no invoice is named', () => {
    const started = startReceipt({
      paymentId: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(10_000_00),
      paidAt: '2026-09-11T10:00:00Z',
      method: 'cash',
    })

    expect(started.payment.allocations).toEqual([])
    expect(started.draft.linkedInvoiceId).toBeUndefined()
  })

  it('allocates to the invoice named, capped at what it still owed (§K)', () => {
    const started = startReceipt({
      paymentId: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(200_000_00),
      paidAt: '2026-09-11T10:00:00Z',
      method: 'bank_transfer',
      invoiceId: 'doc_inv',
      invoiceTotal: NGN(145_000_00),
    })

    expect(started.payment.allocations[0]?.amount).toEqual(NGN(145_000_00))
    expect(started.draft.linkedInvoiceId).toBe('doc_inv')
    // The excess is customer credit: the payment is still the full amount.
    expect(started.payment.amount).toEqual(NGN(200_000_00))
  })

  it('never allocates more than was handed over, for any amount and balance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (amountMinor, owedMinor) => {
          const started = startReceipt({
            paymentId: 'pay_1',
            customerId: 'cus_1',
            amount: NGN(amountMinor),
            paidAt: '2026-09-11T10:00:00Z',
            method: 'cash',
            invoiceId: 'doc_inv',
            invoiceTotal: NGN(owedMinor),
          })
          const allocated = started.payment.allocations[0]?.amount.minor ?? 0
          return allocated === Math.min(amountMinor, owedMinor)
        },
      ),
    )
  })
})

describe('One receipt per payment (§G, §M)', () => {
  it('finds the receipt already issued for a payment', () => {
    expect(receiptForPayment([receipt()], 'pay_1')?.id).toBe('doc_rct')
  })

  it('finds none for a payment nothing points at', () => {
    expect(receiptForPayment([receipt()], 'pay_2')).toBeNull()
  })

  it('ignores a document of another type that happens to carry the id', () => {
    expect(receiptForPayment([receipt({ type: 'invoice' })], 'pay_1')).toBeNull()
  })

  it('lets a voided one be replaced, which is how §G reissues', () => {
    expect(receiptForPayment([receipt({ status: 'void' })], 'pay_1')).toBeNull()
  })

  it('derives one key per payment, so a retried create collapses (§M)', () => {
    expect(receiptKeyFor('pay_1')).toBe('rct:pay_1')
    expect(receiptKeyFor('pay_1')).toBe(receiptKeyFor('pay_1'))
    expect(receiptKeyFor('pay_2')).not.toBe(receiptKeyFor('pay_1'))
  })

  it('derives one key per payment submission too, so money never doubles', () => {
    const twice = [1, 2].map(() =>
      startReceipt({
        paymentId: 'sub_1',
        customerId: 'cus_1',
        amount: NGN(5_000_00),
        paidAt: '2026-09-11T10:00:00Z',
        method: 'cash',
      }),
    )
    expect(twice[0]?.paymentKey).toBe(twice[1]?.paymentKey)
  })

  it('lists only the payments with nothing acknowledging them yet', () => {
    const first = payment()
    const second = payment({ id: 'pay_2', amount: NGN(1_000_00) })
    expect(paymentsAwaitingReceipt([first, second], [receipt()]).map((p) => p.id)).toEqual(['pay_2'])
  })

  it('does not offer a reversal, which acknowledges nothing', () => {
    const original = payment()
    const reversal = reversalOf(original, 'pay_1r', '2026-09-12T00:00:00Z')
    expect(paymentsAwaitingReceipt([original, reversal], [])).toEqual([])
  })
})

describe('The picker offers only what this money could settle (§G, §K)', () => {
  const owed = (id: string, customerId: string, amount: ReturnType<typeof NGN>) => ({
    id,
    customerId,
    reference: `INV-${id}`,
    outstanding: amount,
  })

  it('offers nothing until the payer is named', () => {
    expect(settleableInvoices([owed('a', 'cus_1', NGN(1_000_00))], '', 'NGN')).toEqual([])
  })

  it('never offers another customer balance', () => {
    const options = settleableInvoices(
      [owed('a', 'cus_1', NGN(1_000_00)), owed('b', 'cus_2', NGN(9_000_00))],
      'cus_1',
      'NGN',
    )
    expect(options.map((invoice) => invoice.id)).toEqual(['a'])
  })

  it('never offers a balance in another currency', () => {
    const options = settleableInvoices(
      [owed('a', 'cus_1', NGN(1_000_00)), { ...owed('b', 'cus_1', NGN(0)), outstanding: USD(500) }],
      'cus_1',
      'NGN',
    )
    expect(options.map((invoice) => invoice.id)).toEqual(['a'])
  })

  it('never offers a settled one', () => {
    expect(settleableInvoices([owed('a', 'cus_1', NGN(0))], 'cus_1', 'NGN')).toEqual([])
  })

  it('puts the biggest balance first, and is stable for equal ones', () => {
    const options = settleableInvoices(
      [owed('b', 'cus_1', NGN(500)), owed('c', 'cus_1', NGN(9_000)), owed('a', 'cus_1', NGN(500))],
      'cus_1',
      'NGN',
    )
    expect(options.map((invoice) => invoice.id)).toEqual(['c', 'a', 'b'])
  })
})

/**
 * WHAT THE PAYMENT LEFT OWING, frozen onto the receipt (§I, Rule #5).
 *
 * The app knew what a payment left outstanding and printed nothing, so a
 * customer handed a receipt for ₦500,000 against a ₦1,000,000 invoice could
 * not tell from it whether they were square.
 */
describe('The balance a receipt reports', () => {
  const made = (paidMinor: number, owedBefore?: number) =>
    receiptRecordFor({
      payment: {
        id: 'pay_1',
        customerId: 'cus_1',
        amount: NGN(paidMinor),
        paidAt: '2026-09-11T10:00:00.000Z',
      },
      description: 'Payment received',
      ...(owedBefore === undefined
        ? {}
        : { linkedInvoiceId: 'doc_inv', invoiceOutstandingBefore: NGN(owedBefore) }),
    })

  it('reports what is left on a part payment', () => {
    expect(made(500_000_00, 1_000_000_00).balanceAfterMinor).toBe(500_000_00)
  })

  it('reports zero — "paid in full" — when the payment clears it', () => {
    expect(made(1_000_000_00, 1_000_000_00).balanceAfterMinor).toBe(0)
  })

  /**
   * NEVER BELOW ZERO. Paying more than is owed settles the debt and leaves the
   * surplus as customer credit (§K) — a receipt reporting a NEGATIVE balance
   * would be telling somebody the business owes them, which is a different
   * claim entirely and one this document is not entitled to make.
   */
  it('clamps an overpayment to nothing owed, never to a negative', () => {
    expect(made(1_500_000_00, 1_000_000_00).balanceAfterMinor).toBe(0)
  })

  /** A standalone receipt settles no debt and reports the state of none. */
  it('reports nothing at all on a standalone receipt', () => {
    expect(made(500_000_00).balanceAfterMinor).toBeUndefined()
  })
})
