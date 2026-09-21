/**
 * What one part payment produces (§K, §V, Rule #3).
 *
 * The owner recorded a payment, then pressed a second button for the receipt,
 * then a third for the balance — three gestures for one event, and the last
 * two easy to forget. A customer who paid half got no evidence and no bill
 * for the rest.
 */

import { describe, expect, it } from 'vitest'

import { money } from '../../domain/money/money'
import { quantity } from '../../domain/documents/types'
import { planSettlement } from './settleAndBill'

const NGN = (minor: number) => money('NGN', minor)

const TOTAL = 145_000_00

const GOODS = [
  {
    id: 'li_1',
    description: 'Cement 50kg',
    quantityMilli: quantity(20),
    unitPriceMinor: 5_000_00,
    taxable: false,
  },
  {
    id: 'li_2',
    description: 'Labour 6 hrs',
    quantityMilli: quantity(6),
    unitPriceMinor: 7_500_00,
    taxable: false,
  },
]

const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'doc_inv',
  type: 'invoice',
  status: 'issued',
  currency: 'NGN',
  customerId: 'cus_1',
  issuedReference: 'INV-0042',
  lineItems: GOODS,
  totalMinor: TOTAL,
  ...over,
})

const payment = (minor: number, at = '2026-09-21') => ({
  id: 'pay_1',
  customerId: 'cus_1',
  amount: NGN(minor),
  paidAt: at,
})

const plan = (
  paidMinor: number,
  over: Record<string, unknown> = {},
  documents: { id: string; type: string; status: string; billsBalanceOfId?: string; supersedesId?: string }[] = [],
  earlier: { paidAt: string; amountMinor: number }[] = [],
) =>
  planSettlement({
    invoice: invoice(over),
    payment: payment(paidMinor),
    deductions: [
      ...earlier.map((row) => ({ paidAt: row.paidAt, amount: NGN(row.amountMinor) })),
      { paidAt: '2026-09-21', amount: NGN(paidMinor) },
    ],
    outstandingBefore: NGN(TOTAL - earlier.reduce((n, r) => n + r.amountMinor, 0)),
    documents,
    today: '2026-09-21',
    receiptDescription: 'Payment against INV-0042',
  })

describe('A part payment produces both documents (§K, §V)', () => {
  /** THE ONE THIS IS FOR: one act, two documents, no extra taps. */
  it('plans a receipt and a balance invoice together', () => {
    const made = plan(50_000_00)
    expect(made.receipt.fields.type).toBe('receipt')
    expect(made.balance).not.toBeNull()
    expect(made.balance?.fields.type).toBe('invoice')
  })

  /** The receipt is for what arrived; the balance is for what has not. */
  it('splits the money the right way round', () => {
    const made = plan(50_000_00)
    expect(made.receipt.fields.totalMinor).toBe(50_000_00)
    expect(made.balance?.fields.billedTotalMinor).toBe(TOTAL)
    expect(made.balance?.fields.deductions).toEqual([
      { paidAt: '2026-09-21', amountMinor: 50_000_00 },
    ])
  })

  /** Both carry the goods, so neither is a bare figure (§K). */
  it('gives both documents the invoice’s own items', () => {
    const made = plan(50_000_00)
    expect(made.receipt.fields.lineItems).toHaveLength(2)
    expect(made.balance?.fields.lineItems).toHaveLength(2)
  })

  it('links the receipt to the invoice it settles', () => {
    expect(plan(50_000_00).receipt.fields.linkedInvoiceId).toBe('doc_inv')
  })

  it('links the balance invoice to the invoice it follows', () => {
    expect(plan(50_000_00).balance?.fields.billsBalanceOfId).toBe('doc_inv')
  })
})

describe('A payment that clears the debt produces only a receipt (§K)', () => {
  /**
   * An invoice for nothing has no purpose, and a follow-up asking for zero
   * would sit in the list for ever looking unpaid.
   */
  it('makes no balance invoice when the payment settles it', () => {
    const made = plan(TOTAL)
    expect(made.receipt.fields.totalMinor).toBe(TOTAL)
    expect(made.balance).toBeNull()
  })

  /** Overpayment is customer credit, not a debt the other way round. */
  it('makes no balance invoice when the payment is more than the debt', () => {
    expect(plan(TOTAL + 50_000_00).balance).toBeNull()
  })

  /** One minor unit short is still a debt, and it gets its document. */
  it('bills a single minor unit if that is what is left', () => {
    const made = plan(TOTAL - 1)
    expect(made.balance).not.toBeNull()
  })
})

describe('Instalments replace rather than accumulate (§K)', () => {
  /**
   * THE CAUTION THE OWNER RAISED. Five instalments must not leave five
   * invoices — each new balance invoice names the one before it, and
   * `supersession.ts` stops the replaced one asking for anything.
   */
  it('names the live follow-up it takes over from', () => {
    const live = {
      id: 'doc_bal1',
      type: 'invoice',
      status: 'issued',
      billsBalanceOfId: 'doc_inv',
    }
    const made = plan(30_000_00, {}, [invoice(), live], [
      { paidAt: '2026-09-10', amountMinor: 50_000_00 },
    ])
    expect(made.balance?.fields.supersedesId).toBe('doc_bal1')
  })

  it('names nothing on the first instalment', () => {
    expect(plan(50_000_00).balance?.fields.supersedesId).toBeUndefined()
  })

  /**
   * A CANCELLED follow-up is not taken over from — the debt went home to the
   * original when it was voided, so the new one starts fresh rather than
   * claiming to replace a document that stopped asking.
   */
  it('does not take over from a cancelled follow-up', () => {
    const cancelled = {
      id: 'doc_bal1',
      type: 'invoice',
      status: 'void',
      billsBalanceOfId: 'doc_inv',
    }
    const made = plan(30_000_00, {}, [invoice(), cancelled], [
      { paidAt: '2026-09-10', amountMinor: 50_000_00 },
    ])
    expect(made.balance?.fields.supersedesId).toBeUndefined()
  })

  /** Every instalment so far is deducted, in the order the money arrived. */
  it('deducts every payment so far, not only the latest', () => {
    const made = plan(30_000_00, {}, [], [
      { paidAt: '2026-09-01', amountMinor: 10_000_00 },
      { paidAt: '2026-09-10', amountMinor: 50_000_00 },
    ])
    expect(made.balance?.fields.deductions.map((row) => row.amountMinor)).toEqual([
      10_000_00, 50_000_00, 30_000_00,
    ])
    expect(made.balance?.fields.billedTotalMinor).toBe(TOTAL)
  })
})

describe('A refusal never looks like a failed payment (§K)', () => {
  /**
   * The money has already arrived by the time this runs. An invoice that
   * cannot carry a follow-up still gets its receipt — reporting an error here
   * would tell the owner their payment had not gone through.
   */
  it.each([
    ['void', { status: 'void' }],
    ['a draft', { status: 'draft' }],
    ['a quotation', { type: 'quotation' }],
  ])('still plans the receipt when the invoice is %s', (_name, over) => {
    const made = plan(50_000_00, over)
    expect(made.receipt.fields.type).toBe('receipt')
    expect(made.balance).toBeNull()
  })
})

describe('The same gesture twice makes the same documents (§M)', () => {
  /** Money is the one place a retry must never add (Rule #3). */
  it('keys the receipt on the payment', () => {
    expect(plan(50_000_00).receipt.key).toBe(plan(50_000_00).receipt.key)
  })

  it('keys the balance on the invoice and what is left', () => {
    expect(plan(50_000_00).balance?.key).toBe(plan(50_000_00).balance?.key)
  })

  /** A later instalment is a different act and gets a key of its own. */
  it('gives a different key once more money has arrived', () => {
    const first = plan(50_000_00).balance?.key
    const second = plan(30_000_00, {}, [], [{ paidAt: '2026-09-10', amountMinor: 50_000_00 }])
      .balance?.key
    expect(first).not.toBe(second)
  })
})
