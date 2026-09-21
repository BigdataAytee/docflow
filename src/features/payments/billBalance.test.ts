/**
 * Billing the remainder of a part-paid invoice (§G, §K, Rule #3, Rule #5).
 *
 * The owner's complaint: after a part payment the screen says "₦50,000 paid of
 * ₦145,000 · ₦95,000 left" and there is nothing to press. Asking for the rest
 * meant a new invoice, the right customer, and the balance retyped by hand
 * from the screen behind them.
 *
 * AND THEN: it drew ONE line — "Balance of INV-0042" at the outstanding
 * amount — so a customer received a bill for ₦95,000 with nothing on it
 * saying what the ₦95,000 was for. It carries the goods and the payments now,
 * and reads as a statement rather than as a second bill for the whole job.
 */

import { describe, expect, it } from 'vitest'

import { BillBalanceError, balanceInvoiceDraft, billBalanceKeyFor } from './billBalance'
import { money } from '../../domain/money/money'
import { computeTotals } from '../../domain/money/totals'
import { statementAddsUp } from '../../domain/payments/balanceStatement'
import { quantity } from '../../domain/documents/types'

const NGN = (minor: number) => money('NGN', minor)

/** Two lines that come to ₦145,000, untaxed — the brief's own example. */
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
  totalMinor: 145_000_00,
  ...over,
})

const PAID_FIRST = { paidAt: '2026-09-21', amount: NGN(50_000_00) }

const draft = (over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  balanceInvoiceDraft({
    invoice: invoice(over),
    deductions: [PAID_FIRST],
    today: '2026-09-18',
    ...extra,
  })

describe('The document that asks for what is left (§K)', () => {
  /**
   * THE ONE THE OWNER ASKED FOR. The goods, not a single "balance" line —
   * "the customer sees what they bought and that this is only the remainder".
   */
  it('carries the original’s items rather than one summary line', () => {
    const made = draft()
    expect(made.lineItems).toHaveLength(2)
    expect(made.lineItems.map((line) => line.description)).toEqual([
      'Cement 50kg',
      'Labour 6 hrs',
    ])
    expect(made.lineItems.map((line) => line.unitPriceMinor)).toEqual([5_000_00, 7_500_00])
  })

  /**
   * FRESH LINE IDS. These are lines on a NEW document; reusing the original's
   * would make two records claim one line the moment anything is keyed by it.
   */
  it('gives the carried lines ids of their own', () => {
    const made = draft()
    expect(made.lineItems.map((line) => line.id)).not.toEqual(GOODS.map((line) => line.id))
    expect(new Set(made.lineItems.map((line) => line.id)).size).toBe(2)
  })

  /** The frozen total, stated as its own figure — the "Invoice total" line. */
  it('states the original’s frozen total', () => {
    expect(draft().billedTotalMinor).toBe(145_000_00)
  })

  /** Every payment, in the order the money arrived, with its date. */
  it('lists what has already been paid', () => {
    expect(draft().deductions).toEqual([{ paidAt: '2026-09-21', amountMinor: 50_000_00 }])
  })

  it('lists five instalments as five deductions, oldest first', () => {
    const made = draft(
      {},
      {
        deductions: [
          { paidAt: '2026-09-01', amount: NGN(10_000_00) },
          { paidAt: '2026-09-08', amount: NGN(20_000_00) },
          { paidAt: '2026-09-15', amount: NGN(30_000_00) },
        ],
      },
    )
    expect(made.deductions.map((row) => row.amountMinor)).toEqual([
      10_000_00, 20_000_00, 30_000_00,
    ])
  })

  /**
   * THE CARRIED ITEMS ACCOUNT FOR THE STATED TOTAL.
   *
   * The balance is computed from the FROZEN total, never from these lines —
   * but if the two disagree the customer holds a document whose figures
   * contradict each other, so this asserts they do not.
   */
  it('carries items that add up to the total printed beneath them', () => {
    const made = draft()
    const computed = computeTotals({
      type: 'invoice',
      currency: made.currency,
      lines: made.lineItems,
      ...(made.taxRatePpm === undefined ? {} : { taxRate: made.taxRatePpm }),
      ...(made.whtRatePpm === undefined ? {} : { whtRate: made.whtRatePpm }),
    })
    expect(statementAddsUp(NGN(made.billedTotalMinor), computed.payable)).toBe(true)
  })

  /** And with tax, the rates come across so the breakdown still reconciles. */
  it('carries the original’s rates so a taxed invoice still reconciles', () => {
    const taxed = balanceInvoiceDraft({
      invoice: invoice({
        lineItems: GOODS.map((line) => ({ ...line, taxable: true })),
        totalMinor: 155_875_00,
        taxRatePpm: 75_000,
      }),
      deductions: [PAID_FIRST],
      today: '2026-09-18',
    })
    const computed = computeTotals({
      type: 'invoice',
      currency: taxed.currency,
      lines: taxed.lineItems,
      ...(taxed.taxRatePpm === undefined ? {} : { taxRate: taxed.taxRatePpm }),
    })
    expect(taxed.taxRatePpm).toBe(75_000)
    expect(statementAddsUp(NGN(taxed.billedTotalMinor), computed.payable)).toBe(true)
  })

  it('keeps the customer and the currency', () => {
    const made = draft()
    expect(made.customerId).toBe('cus_1')
    expect(made.currency).toBe('NGN')
  })

  it('is dated today, not the original’s date', () => {
    expect(draft().issueDate).toBe('2026-09-18')
  })

  /** Both documents name each other, so neither reads as a separate charge. */
  it('links back to the invoice it follows', () => {
    expect(draft().billsBalanceOfId).toBe('doc_inv')
  })

  /**
   * ONLY ONE LIVE AT A TIME. A second part payment produces a balance
   * invoice that REPLACES the first rather than joining it — five
   * instalments must not leave five invoices (§K).
   */
  it('names the balance invoice it takes over from', () => {
    expect(draft({}, { replacesId: 'doc_bal1' }).supersedesId).toBe('doc_bal1')
  })

  it('names nothing when it is the first', () => {
    expect(draft().supersedesId).toBeUndefined()
  })
})

describe('What it refuses, because each would say something untrue', () => {
  it('refuses a settled invoice — there is no remainder', () => {
    expect(() =>
      balanceInvoiceDraft({
        invoice: invoice(),
        deductions: [{ paidAt: '2026-09-21', amount: NGN(145_000_00) }],
        today: '2026-09-18',
      }),
    ).toThrow(BillBalanceError)
  })

  /** Overpaid is settled, not owed the other way round (Rule #3). */
  it('refuses an overpaid invoice', () => {
    expect(() =>
      balanceInvoiceDraft({
        invoice: invoice(),
        deductions: [{ paidAt: '2026-09-21', amount: NGN(200_000_00) }],
        today: '2026-09-18',
      }),
    ).toThrow(BillBalanceError)
  })

  it('refuses a draft, which has asked for nothing yet', () => {
    expect(() => draft({ status: 'draft' })).toThrow(BillBalanceError)
  })

  it('refuses a cancelled invoice, which is not owed', () => {
    expect(() => draft({ status: 'void' })).toThrow(BillBalanceError)
  })

  /** A quotation has not been billed; a delivery carries no money at all (§V). */
  it.each(['quotation', 'receipt', 'waybill'])('refuses a %s', (type) => {
    expect(() => draft({ type })).toThrow(BillBalanceError)
  })

  /** Money is never mixed across currencies (Rule #3). */
  it('refuses a payment in another currency', () => {
    expect(() =>
      balanceInvoiceDraft({
        invoice: invoice(),
        deductions: [{ paidAt: '2026-09-21', amount: money('GHS', 50_000_00) }],
        today: '2026-09-18',
      }),
    ).toThrow()
  })
})

describe('It moves no money (§K)', () => {
  /**
   * The draft is a fresh REQUEST for the same debt, not a settlement of it.
   * Nothing here writes to the ledger, and the original keeps its own
   * payments — `billsBalanceOfId` is what stops the two being counted twice,
   * and that rule lives in `supersession.ts`.
   */
  it('is a draft, so it asks for nothing until it is issued', () => {
    expect(draft().status).toBe('draft')
    expect(draft().totalMinor).toBe(0)
  })
})

describe('The same gesture twice makes one document (§M)', () => {
  /**
   * Keyed on the invoice AND the balance, so a retry is idempotent while a
   * LATER follow-up — after more money has arrived — is a different act and
   * gets its own key.
   */
  it('is the same key for the same balance', () => {
    expect(billBalanceKeyFor('doc_inv', 95_000_00)).toBe(billBalanceKeyFor('doc_inv', 95_000_00))
  })

  it('is a different key once more money has arrived', () => {
    expect(billBalanceKeyFor('doc_inv', 95_000_00)).not.toBe(
      billBalanceKeyFor('doc_inv', 65_000_00),
    )
  })
})
