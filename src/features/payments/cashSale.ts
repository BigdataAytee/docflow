/**
 * A cash sale that was not paid in full (§G, §K, §V).
 *
 * THE DEBT HAS TO EXIST SOMEWHERE. Somebody sells ₦100,000 of goods over the
 * counter and is handed ₦40,000. The receipt can say what happened — and after
 * this, it does — but a receipt is evidence of a payment, not a claim on
 * anybody. If the app stops there, the ₦60,000 still owed appears in no
 * balance, no Outstanding, no ageing report and nothing to chase: a debt that
 * is real in the yard and invisible in the ledger.
 *
 * So the app bills it. An invoice is created for the FULL sale, the payment is
 * allocated against it, and the remainder becomes an ordinary debt — the same
 * shape a quotation takes when it is paid (`quotationPaid.ts`), and for the
 * same reason: money can only be owed against something that asked for it.
 *
 * IN FULL, never for the remainder. Billing ₦60,000 would quietly rewrite the
 * sale to match what was left over: the customer's history would show a
 * ₦60,000 purchase they never made, and the ₦40,000 they handed over would be
 * allocated to nothing. The invoice is what was sold; the ledger says how much
 * of it has arrived.
 *
 * AND ONLY WHEN IT IS SHORT. Paid in full is the common case and costs nothing
 * extra — no invoice, no second document, no extra tap. That is the whole
 * point of the amount being prefilled to the total.
 *
 * WHAT THIS MODULE DOES NOT DO: write anything. It returns records and keys,
 * and the caller commits them in order.
 */

import type { DocumentDraft } from '../documents/builder'
import type { LineItem } from '../../domain/documents/types'
import { type Money, money } from '../../domain/money/money'
import { computeTotals } from '../../domain/money/totals'

export class CashSaleError extends Error {
  constructor(readonly reason: 'no_customer' | 'nothing_sold' | 'nothing_paid' | 'overpaid') {
    super(reason)
    this.name = 'CashSaleError'
  }
}

/**
 * What a receipt's own goods come to. Never the payment (§V).
 *
 * THE RATES ARE ARGUMENTS, and that is the whole lesson of the three-figure
 * bug. This computed a bare sum while the printed page applied the company's
 * discount and tax, so one ₦100,000 sale read as ₦107,500 on the paper,
 * ₦100,000 in its own evidence block, and ₦100,000 on the bill raised for the
 * remainder — with the customer chased for the smallest of the three.
 *
 * Same function, same inputs, one answer: the Totals step, the record that is
 * written, the bill for the remainder and the printed sheet all call this.
 */
export function saleTotal(
  currency: string,
  lineItems: readonly LineItem[],
  rates: { readonly discountRate?: number; readonly taxRate?: number } = {},
): Money {
  return computeTotals({
    type: 'receipt',
    currency,
    lines: lineItems,
    ...(rates.discountRate === undefined ? {} : { discountRate: rates.discountRate }),
    ...(rates.taxRate === undefined ? {} : { taxRate: rates.taxRate }),
  }).payable
}

export interface CashSaleSplit {
  readonly total: Money
  readonly paid: Money
  readonly balance: Money
  /** True when this payment leaves nothing — the common case (§G). */
  readonly paidInFull: boolean
}

/**
 * The three figures, worked out ONCE.
 *
 * The block at the foot of the Items step, the record that gets written and
 * the printed receipt all read them. Three copies of this subtraction would be
 * three chances to disagree about one number, and the disagreement would be a
 * customer holding a receipt whose figures do not add up.
 *
 * Never below zero: handing over more than the goods came to is customer
 * credit (§K), not a negative debt, so the receipt says "Paid in full" and no
 * invoice is created for a balance nobody owes.
 */
export function cashSaleSplit(input: { total: Money; paidMinor: number }): CashSaleSplit {
  const balanceMinor = Math.max(0, input.total.minor - input.paidMinor)
  return {
    total: input.total,
    paid: money(input.total.currency, input.paidMinor),
    balance: money(input.total.currency, balanceMinor),
    paidInFull: balanceMinor === 0,
  }
}

/**
 * The idempotency handle for the invoice a short-paid cash sale produces (§M).
 *
 * Derived from the RECEIPT, so saving twice — a double tap, a retried commit,
 * a screen that came back — finds the invoice the first save made rather than
 * billing the customer a second time. Arithmetic, not a check that could race.
 */
export const invoiceForCashSaleKeyFor = (receiptId: string): string => `cash:${receiptId}`

/**
 * The handle for the payment as re-recorded against that invoice.
 *
 * The payment already exists — Path B writes it before the builder opens — and
 * the amount on the Items step may differ from what was first typed. The
 * ledger is append-only (§K), so the original is reversed and a replacement is
 * recorded allocated to the new invoice. Both halves are keyed off the receipt
 * so a retry lands on the same pair.
 */
export const cashSalePaymentKeyFor = (receiptId: string): string => `cash:${receiptId}:paid`
export const cashSaleReversalKeyFor = (receiptId: string): string => `cash:${receiptId}:rev`

export interface CashSaleInvoice {
  /** The bill for what was sold, in full. */
  readonly invoice: DocumentDraft
  readonly idempotencyKey: string
  readonly split: CashSaleSplit
}

/**
 * The invoice a short-paid cash sale becomes.
 *
 * Its OWN goods and its own dates: this is not a conversion of another
 * document, it is the bill that should have been written when the sale
 * happened and was not. Due today, because the debt is already overdue in
 * every sense that matters — the goods have gone.
 */
export function invoiceForCashSale(input: {
  readonly receipt: {
    readonly currency: string
    readonly lineItems: readonly LineItem[]
    readonly customerId?: string
    readonly paidAmountMinor?: number
  }
  readonly receiptId: string
  readonly today: string
  /**
   * The rates the SALE was computed at, carried onto the bill.
   *
   * Not the company's defaults read again here: a discount knocked off at the
   * counter and the rate in force that day are facts about this sale, and the
   * bill for what is still owed has to agree with the receipt that names it
   * down to the kobo. Passing them means one computation, two documents.
   */
  readonly rates?: { readonly discountRate?: number; readonly taxRate?: number }
}): CashSaleInvoice {
  const { receipt, rates = {} } = input
  if (receipt.customerId === undefined) throw new CashSaleError('no_customer')
  if (receipt.lineItems.length === 0) throw new CashSaleError('nothing_sold')

  const total = saleTotal(receipt.currency, receipt.lineItems, rates)
  const paidMinor = receipt.paidAmountMinor ?? total.minor
  if (paidMinor <= 0) throw new CashSaleError('nothing_paid')

  const split = cashSaleSplit({ total, paidMinor })
  if (split.paidInFull) throw new CashSaleError('overpaid')

  return {
    invoice: {
      type: 'invoice',
      currency: receipt.currency,
      customerId: receipt.customerId,
      /*
       * THE SAME GOODS, taxable exactly as they were sold.
       *
       * Sharing ids with the receipt's lines would make two documents claim
       * the same rows, which §E's line-item json cannot express and sync
       * would have to guess at — so the ids are fresh and nothing else moves.
       */
      lineItems: receipt.lineItems.map((line, index) => ({
        ...line,
        id: `${input.receiptId}:inv:${index}`,
      })),
      /*
       * AND THE RATES IT WAS COMPUTED AT, stored rather than left to fall
       * back (Rule #5, §K).
       *
       * Without them the page reads whatever Settings says on the day it is
       * re-rendered, so a bill raised today could ask for a different figure
       * next year — beside a receipt frozen at today's.
       */
      ...(rates.taxRate === undefined ? {} : { taxRatePpm: rates.taxRate }),
      issueDate: input.today,
      dueDate: input.today,
    },
    idempotencyKey: invoiceForCashSaleKeyFor(input.receiptId),
    split,
  }
}
