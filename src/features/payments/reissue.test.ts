/**
 * Void and reissue a receipt (§G, Rule #5, §V).
 */

import { describe, expect, it } from 'vitest'

import { money } from '../../domain/money/money'
import { type Payment, receivedByCurrency, reversalOf } from '../../domain/payments/ledger'
import { recordPayment } from './record'
import {
  ReissueError,
  type ReissuableDocument,
  canReissue,
  reasonsReissueIsBlocked,
  reissueKeyFor,
  voidAndReissue,
} from './reissue'

const NGN = (m: number) => money('NGN', m)

const PAYMENT: Payment = recordPayment({
  id: 'pay_1',
  customerId: 'cus_1',
  amount: NGN(50_000_00),
  paidAt: '2026-09-10T09:00:00Z',
  method: 'bank_transfer',
})

const receipt = (over: Partial<ReissuableDocument> = {}): ReissuableDocument => ({
  id: 'doc_rct',
  type: 'receipt',
  status: 'issued',
  paymentId: 'pay_1',
  issuedReference: 'REC-0003',
  ...over,
})

const reissue = (document = receipt(), payments: Payment[] = [PAYMENT]) =>
  voidAndReissue(document, { payments, description: 'Payment received' })

describe('Only an issued receipt is voided and reissued (§G, Rule #5)', () => {
  it('is offered on an issued receipt with a payment behind it', () => {
    expect(canReissue(receipt(), [PAYMENT])).toBe(true)
  })

  it('is not offered on any other type', () => {
    // An invoice is corrected by void or credit note; a quotation by Rev 2;
    // a delivery note's evidence seals.
    for (const type of ['invoice', 'quotation', 'waybill'] as const) {
      expect(reasonsReissueIsBlocked(receipt({ type }), [PAYMENT])).toBe('not_reissuable_type')
    }
  })

  it('is not offered on a draft, which can simply be edited', () => {
    expect(reasonsReissueIsBlocked(receipt({ status: 'draft' }), [PAYMENT])).toBe('not_issued')
  })

  it('is not offered on one already cancelled', () => {
    // There is nothing left to cancel, and the replacement comes from the
    // payment's own Receipt button instead.
    expect(reasonsReissueIsBlocked(receipt({ status: 'void' }), [PAYMENT])).toBe('already_void')
  })
})

describe('Nothing is reissued for money that is not there (§K, §V)', () => {
  it('refuses a receipt that names no payment', () => {
    const { paymentId: _none, ...nameless } = receipt()
    expect(reasonsReissueIsBlocked(nameless, [PAYMENT])).toBe('no_payment')
  })

  it('refuses when the payment is gone', () => {
    expect(reasonsReissueIsBlocked(receipt(), [])).toBe('payment_missing')
  })

  it('refuses when the payment was reversed — the money came back', () => {
    const reversal = reversalOf(PAYMENT, 'pay_1r', '2026-09-11T00:00:00Z')
    expect(reasonsReissueIsBlocked(receipt(), [PAYMENT, reversal])).toBe('payment_reversed')
  })

  it('throws rather than drawing a receipt for a payment nobody made', () => {
    expect(() => reissue(receipt(), [])).toThrow(ReissueError)
    try {
      reissue(receipt(), [])
    } catch (cause) {
      expect((cause as ReissueError).field).toBe('payment_missing')
    }
  })
})

describe('The money never moves, in either direction (§V)', () => {
  it('says so in the value, not in a comment', () => {
    expect(reissue().leavesPaymentAlone).toBe(true)
  })

  it('leaves income exactly where it was, however often it is drawn', () => {
    const before = receivedByCurrency([PAYMENT], '2026-09-01', '2026-10-01')
    for (let i = 0; i < 5; i += 1) reissue()
    const after = receivedByCurrency([PAYMENT], '2026-09-01', '2026-10-01')
    expect(after.get('NGN')).toEqual(before.get('NGN'))
    expect(after.get('NGN')).toEqual(NGN(50_000_00))
  })

  it('produces no payment, no allocation and no reversal', () => {
    const result = reissue()
    // The only things it names are documents.
    expect(Object.keys(result).sort()).toEqual([
      'idempotencyKey',
      'leavesPaymentAlone',
      'replacement',
      'voidId',
    ])
  })
})

describe('The replacement is the same payment, drawn again (§G)', () => {
  it('carries the payment, the amount and the day the money arrived', () => {
    const { replacement } = reissue()
    expect(replacement.paymentId).toBe('pay_1')
    expect(replacement.totalMinor).toBe(50_000_00)
    expect(replacement.issueDate).toBe('2026-09-10')
    expect(replacement.status).toBe('draft')
  })

  it('keeps the invoice the payment settled, if there was one', () => {
    expect(reissue(receipt({ linkedInvoiceId: 'doc_inv' })).replacement.linkedInvoiceId).toBe(
      'doc_inv',
    )
  })

  it('says what it replaces, so one payment is never read as two', () => {
    // The customer is holding the cancelled one. Two receipts for one payment,
    // neither mentioning the other, is how a payment gets counted twice.
    expect(reissue().replacement.supersedesId).toBe('doc_rct')
  })

  it('names the receipt to cancel, and cancels nothing else', () => {
    expect(reissue().voidId).toBe('doc_rct')
  })
})

describe('A retried gesture makes one replacement (§M)', () => {
  it('derives the key from the receipt being replaced', () => {
    expect(reissueKeyFor('doc_rct')).toBe('reissue:doc_rct')
    expect(reissue().idempotencyKey).toBe(reissue().idempotencyKey)
  })

  it('cannot collide with the key the cancelled receipt was made under', () => {
    // That one was `rct:pay_1`. Colliding would hand back the cancelled
    // document instead of making the replacement.
    expect(reissueKeyFor('doc_rct')).not.toBe('rct:pay_1')
  })

  it('gives a second reissue of the replacement its own key', () => {
    expect(reissueKeyFor('doc_rct2')).not.toBe(reissueKeyFor('doc_rct'))
  })
})
