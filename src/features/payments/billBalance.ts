/**
 * Billing the remainder of a part-paid invoice (§G, §K, Rule #3).
 *
 * A customer pays ₦50,000 against a ₦145,000 invoice. The original is issued
 * and therefore frozen (Rule #5) — its reference, totals and labels cannot
 * move — so the ₦95,000 still owed has to be asked for on a NEW document, and
 * until now the owner built that by hand: new invoice, right customer, right
 * amount typed from the balance on the screen behind them.
 *
 * WHAT THIS IS NOT. It does not touch the ledger. The original invoice keeps
 * its own balance and its own payments; this draft is a fresh request for the
 * same money, and nothing is settled, moved or double-counted by making one.
 * That matters because the two documents are otherwise easy to read as two
 * debts: they are one debt, asked for twice, and `billsBalanceOfId` is what
 * says so on both.
 *
 * THE AMOUNT IS A SNAPSHOT, deliberately. It is the outstanding figure at the
 * moment the draft is made, not a live link to it — a draft whose total moved
 * every time a payment landed would be a document that says something
 * different each time it is opened, and §M freezes a document at issue for
 * exactly that reason. If more money arrives, a NEW balance invoice replaces
 * this one rather than editing it (see `supersedesId`).
 *
 * IT READS AS A STATEMENT, NOT AS A SECOND BILL. This file used to emit ONE
 * line — "Balance of INV-0002" at the outstanding amount — defended on the
 * grounds that re-listing the original's items "would read as a second
 * request for the whole job". The fear was right; hiding the goods was the
 * wrong answer. The document carries the goods AND what has been paid:
 *
 *     Cement 50kg × 20 ........ ₦100,000
 *     Labour 6 hrs .............. ₦45,000
 *     Invoice total ........ ₦145,000
 *     Less: paid on 21 Sep ...... −₦50,000
 *     Balance due .......... ₦95,000
 *
 * so a customer recognises what they bought and can see, in one line, that
 * part of it is already handled. The single-line version asked them to take
 * ₦95,000 on trust.
 *
 * THE FROZEN TOTAL IS THE AUTHORITY. `billedTotalMinor` is the ORIGINAL's
 * `totalMinor`, and the balance is that minus the deductions — never a
 * recomputation from the carried lines. Re-pricing ten items and re-applying
 * a tax rate would be a second computation of a number that already settled
 * at issue (Rule #5), and the day the two disagree the customer is holding
 * two documents that contradict each other.
 */

import { money } from '../../domain/money/money'
import { type Deduction, balanceDue, storedDeductions } from '../../domain/payments/balanceStatement'
import type { DocumentType, LineItem } from '../../domain/documents/types'

/** The record fields a follow-up invoice is created with (§M). */
export interface BalanceInvoiceFields {
  readonly type: DocumentType
  readonly status: 'draft'
  readonly currency: string
  /** The ORIGINAL's items, carried across so the customer sees the goods. */
  readonly lineItems: readonly LineItem[]
  /**
   * Zero, like every other draft. A total is what ISSUING computes and
   * freezes (Rule #5); a draft's figures are recomputed from its lines each
   * time it is opened, and storing one here would be a number nobody could
   * reproduce from what is on the document.
   */
  readonly totalMinor: 0
  readonly issueDate: string
  readonly customerId?: string
  readonly billsBalanceOfId: string
  /**
   * THE ORIGINAL'S FROZEN TOTAL — the "Invoice total" line, and the figure
   * the balance is computed from. Not recomputed from the lines above: see
   * the note at the top of this file.
   */
  readonly billedTotalMinor: number
  /** Every payment already received, in the order the money arrived. */
  readonly deductions: readonly { readonly paidAt: string; readonly amountMinor: number }[]
  /**
   * The original's frozen rates, carried so the printed breakdown of the
   * carried items matches the invoice total stated beneath them.
   */
  readonly taxRatePpm?: number
  readonly whtRatePpm?: number
  /**
   * The balance invoice this one takes over from, when a further payment has
   * arrived (§G, Rule #5). Only one balance invoice is ever live per
   * original — see `supersession.ts`.
   */
  readonly supersedesId?: string
}

/**
 * The idempotency handle (§M).
 *
 * Derived from the invoice AND the balance being billed, so two taps make one
 * draft — and a LATER follow-up, after more money has come in and the
 * remainder has changed, is a different act and gets its own. Keyed on the
 * invoice alone, the second one would silently return the first.
 */
export const billBalanceKeyFor = (invoiceId: string, outstandingMinor: number): string =>
  `bal:${invoiceId}:${outstandingMinor}`

/*
 * The INTERNAL type this applies to.
 *
 * Named once, as the internal identifier every path and record uses — never
 * as a word anybody reads. Rule #4 allows exactly one place for the label and
 * this is not it.
 */
const BILLABLE_TYPE: DocumentType = 'invoice'

/**
 * Why a balance cannot be billed. A CODE, never a sentence.
 *
 * The first version threw English prose naming the document type — "Only an
 * invoice has a balance to bill" — and the Rule #4 lint rule refused it,
 * correctly: that message reaches the owner through `billBalanceFailed`, and
 * a business whose documents are called something else would be told about a
 * type it does not have. The words belong to the catalogue; the reason
 * belongs here.
 */
export type BillBalanceReason =
  | 'wrong_type'
  | 'not_issued'
  | 'voided'
  | 'nothing_owed'
  | 'currency_mismatch'

export class BillBalanceError extends Error {
  constructor(readonly reason: BillBalanceReason) {
    super(reason)
    this.name = 'BillBalanceError'
  }
}

export interface BillBalanceInput {
  /** The part-paid invoice being followed up. Must be issued. */
  readonly invoice: {
    readonly id: string
    readonly type: string
    readonly status: string
    readonly currency: string
    readonly customerId?: string
    readonly issuedReference?: string | null
    /** Carried across so the customer sees the goods, not just a figure. */
    readonly lineItems: readonly LineItem[]
    /** Frozen at issue (Rule #5), and the authority for the balance. */
    readonly totalMinor: number
    readonly taxRatePpm?: number
    readonly whtRatePpm?: number
  }
  /** Every payment received against the original, oldest first (§K). */
  readonly deductions: readonly Deduction[]
  /** Today, in the document's own calendar (§E). */
  readonly today: string
  /**
   * The live balance invoice this one takes over from, when there is one.
   *
   * Absent on the first follow-up. Present on every one after it, so a
   * customer paying in five instalments ends with one live document rather
   * than five each asking for a different remainder.
   */
  readonly replacesId?: string
}

/**
 * The draft that asks for what is left.
 *
 * Refuses rather than guessing, in three cases that would each produce a
 * document saying something untrue:
 *
 *  · not an invoice — a quotation has not been billed yet and a delivery
 *    carries no money at all (§V), so neither has a balance to chase;
 *  · not issued — a draft has asked for nothing, so nothing is outstanding;
 *  · nothing owed — an invoice settled in full has no remainder, and an
 *    invoice for zero is a document with no purpose.
 */
export function balanceInvoiceDraft(input: BillBalanceInput): BalanceInvoiceFields {
  const { invoice, deductions, today } = input
  const billed = money(invoice.currency, invoice.totalMinor)
  const outstanding = balanceDue(billed, deductions)

  // Only the money-owing type has a balance to chase. A quotation has not
  // been billed yet and a delivery carries no money at all (§V).
  if (invoice.type !== BILLABLE_TYPE) throw new BillBalanceError('wrong_type')
  // A draft has asked for nothing, so nothing is outstanding.
  if (invoice.status === 'draft') throw new BillBalanceError('not_issued')
  // A cancelled document is not owed.
  if (invoice.status === 'void') throw new BillBalanceError('voided')
  // Settled in full: no remainder, and a document for zero has no purpose.
  if (outstanding.minor <= 0) throw new BillBalanceError('nothing_owed')

  return {
    type: BILLABLE_TYPE,
    status: 'draft',
    totalMinor: 0,
    currency: invoice.currency,
    ...(invoice.customerId === undefined ? {} : { customerId: invoice.customerId }),
    issueDate: today,
    /*
     * THE ORIGINAL'S ITEMS, copied.
     *
     * Fresh ids: these are lines on a new document, and reusing the
     * original's would make two records claim one line — which matters the
     * moment anything is keyed by line id, and costs nothing to avoid.
     *
     * The rates come across with them, so the printed breakdown of these
     * lines adds up to the invoice total stated beneath it rather than to
     * some other number. What the BALANCE is computed from is the frozen
     * total, always: see the note at the top of this file.
     */
    lineItems: invoice.lineItems.map((line, index) => ({
      ...line,
      id: `line_bal_${invoice.id}_${index}`,
    })),
    billedTotalMinor: invoice.totalMinor,
    deductions: storedDeductions(deductions),
    ...(invoice.taxRatePpm === undefined ? {} : { taxRatePpm: invoice.taxRatePpm }),
    ...(invoice.whtRatePpm === undefined ? {} : { whtRatePpm: invoice.whtRatePpm }),
    /** Both documents name each other; see the note at the top of this file. */
    billsBalanceOfId: invoice.id,
    /** And this one names the balance invoice it takes over from (§G). */
    ...(input.replacesId === undefined ? {} : { supersedesId: input.replacesId }),
  }
}
