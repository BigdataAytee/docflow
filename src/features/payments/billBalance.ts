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
 * exactly that reason. If more money arrives before this one is issued, the
 * owner edits it like any other draft.
 */

import type { Money } from '../../domain/money/money'
import { type DocumentType, type LineItem, quantity } from '../../domain/documents/types'

/** The record fields a follow-up invoice is created with (§M). */
export interface BalanceInvoiceFields {
  readonly type: DocumentType
  readonly status: 'draft'
  readonly currency: string
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
  }
  /** What is still owed RIGHT NOW, from the ledger. */
  readonly outstanding: Money
  /** Today, in the document's own calendar (§E). */
  readonly today: string
  /** "Balance of {reference}" — the line's description, already localised. */
  readonly description: string
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
  const { invoice, outstanding, today, description } = input

  // Only the money-owing type has a balance to chase. A quotation has not
  // been billed yet and a delivery carries no money at all (§V).
  if (invoice.type !== BILLABLE_TYPE) throw new BillBalanceError('wrong_type')
  // A draft has asked for nothing, so nothing is outstanding.
  if (invoice.status === 'draft') throw new BillBalanceError('not_issued')
  // A cancelled document is not owed.
  if (invoice.status === 'void') throw new BillBalanceError('voided')
  // Settled in full: no remainder, and a document for zero has no purpose.
  if (outstanding.minor <= 0) throw new BillBalanceError('nothing_owed')
  // Money is never mixed across currencies (Rule #3).
  if (outstanding.currency !== invoice.currency) {
    throw new BillBalanceError('currency_mismatch')
  }

  return {
    type: BILLABLE_TYPE,
    status: 'draft',
    totalMinor: 0,
    currency: invoice.currency,
    ...(invoice.customerId === undefined ? {} : { customerId: invoice.customerId }),
    issueDate: today,
    /*
     * ONE LINE, at the exact outstanding amount, quantity one.
     *
     * Not a copy of the original's items: those were already billed, and
     * re-listing them would read as a second request for the whole job rather
     * than for what is left of it. One line naming the invoice it follows is
     * what a customer can reconcile against their own records.
     *
     * `taxable: false` because the tax was computed and charged on the
     * original. Charging it again on the remainder would tax the same goods
     * twice — the balance is a portion of a total that already includes it.
     */
    lineItems: [
      {
        id: `line_balance_${invoice.id}`,
        description,
        quantityMilli: quantity(1),
        unitPriceMinor: outstanding.minor,
        taxable: false,
      },
    ],
    /** Both documents name each other; see the note at the top of this file. */
    billsBalanceOfId: invoice.id,
  }
}
