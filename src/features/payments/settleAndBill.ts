/**
 * What a part payment produces, decided in one place (§K, §V, Rule #3).
 *
 * Money arrives against an invoice. Two documents should follow and neither
 * of them used to: the owner recorded the payment, then pressed a separate
 * button for the receipt, then a third for the balance — three gestures for
 * one event, and the two later ones easy to forget. A customer who paid half
 * got no evidence and no bill for the rest.
 *
 * So this plans BOTH from the one act:
 *
 *  · THE RECEIPT, always. A payment is a thing that happened and the customer
 *    is entitled to proof of it, whether it settled the bill or a tenth of it.
 *  · THE BALANCE INVOICE, only while money is still owed. A payment that
 *    clears the debt produces no follow-up: an invoice for nothing has no
 *    purpose, and `balanceInvoiceDraft` refuses to draw one.
 *
 * IT PLANS RATHER THAN WRITES. Every decision here is a pure function of the
 * ledger and the documents, so the awkward cases — a payment that settles
 * exactly, a fifth instalment, an invoice already followed up — are tested
 * without a store, a screen or a clock. The caller performs the writes.
 *
 * ONLY ONE BALANCE INVOICE IS EVER LIVE. The fifth instalment does not add a
 * fifth document: it names the fourth through `supersedesId`, and
 * `supersession.ts` stops the replaced one asking for anything. Without that
 * the customer paying in instalments would accumulate one live invoice per
 * payment, each for a different remainder, and Home would add them all up.
 *
 * THE ORDER MATTERS AND IS THE CALLER'S TO KEEP. The payment is recorded
 * FIRST, because the money is the fact and the documents are descriptions of
 * it. If the app dies between the payment and the documents, the ledger is
 * still right — Outstanding is computed from payments, and the original still
 * carries the debt because no live follow-up exists yet. The owner presses
 * the button again and the keys make it idempotent (§M). The reverse order
 * would leave a receipt for money the app had no record of receiving.
 */

import type { LineItem } from '../../domain/documents/types'
import { type Money, money } from '../../domain/money/money'
import { type Deduction, balanceDue } from '../../domain/payments/balanceStatement'
import { liveFollowUpFor, type SupersedableDocument } from '../../domain/payments/supersession'
import {
  type BalanceInvoiceFields,
  BillBalanceError,
  balanceInvoiceDraft,
  billBalanceKeyFor,
} from './billBalance'
import { type ReceiptRecordFields, receiptKeyFor, receiptRecordFor } from './receiptFlow'

export interface SettlementInput {
  /** The invoice the money landed against, already issued. */
  readonly invoice: {
    readonly id: string
    readonly type: string
    readonly status: string
    readonly currency: string
    readonly customerId?: string
    readonly issuedReference?: string | null
    readonly lineItems: readonly LineItem[]
    readonly totalMinor: number
    readonly taxRatePpm?: number
    readonly whtRatePpm?: number
  }
  /** The payment that has just been recorded — it already exists (§K). */
  readonly payment: {
    readonly id: string
    readonly customerId: string
    readonly amount: Money
    readonly paidAt: string
  }
  /**
   * Every payment against this invoice INCLUDING the one just recorded, with
   * the calendar day each arrived (§E).
   *
   * Passed in rather than looked up: this module knows nothing about the
   * ledger, and the caller has already read it.
   */
  readonly deductions: readonly Deduction[]
  /** What the invoice owed BEFORE this payment — printed on the receipt. */
  readonly outstandingBefore: Money
  /** Every document, so a live follow-up can be found and replaced. */
  readonly documents: readonly SupersedableDocument[]
  /** Today, in the company's calendar (§E). */
  readonly today: string
  /** "Payment against {label} {reference}" — already localised (Rule #4). */
  readonly receiptDescription: string
}

export interface SettlementPlan {
  /** Always present: a payment always earns its evidence (§V). */
  readonly receipt: { readonly fields: ReceiptRecordFields; readonly key: string }
  /**
   * Null when the payment settled the invoice, or when there is nothing this
   * module may bill — a draft, a cancelled invoice, a type that carries no
   * balance. `balanceInvoiceDraft` is the authority on all of those and its
   * refusal is taken as "no follow-up", never surfaced as an error: the
   * payment succeeded, which is the part that matters.
   */
  readonly balance: { readonly fields: BalanceInvoiceFields; readonly key: string } | null
}

/**
 * The two documents a payment produces, or the one.
 *
 * Never throws. A payment that cannot produce a follow-up still produces a
 * receipt, and the caller gets a plan rather than an exception to decide
 * about — the money has already arrived and nothing here is allowed to make
 * that look like a failure.
 */
export function planSettlement(input: SettlementInput): SettlementPlan {
  const { invoice, payment, deductions, documents, today } = input

  const receipt = {
    fields: receiptRecordFor({
      payment,
      description: input.receiptDescription,
      linkedInvoiceId: invoice.id,
      invoiceOutstandingBefore: input.outstandingBefore,
      invoiceLineItems: invoice.lineItems,
      invoiceTotal: money(invoice.currency, invoice.totalMinor),
    }),
    key: receiptKeyFor(payment.id),
  }

  /*
   * WHAT IS LEFT, for the key below only.
   *
   * There is deliberately no `if (owed <= 0) return` here.
   * `balanceInvoiceDraft` already refuses a settled invoice — that is its
   * `nothing_owed` case — and the catch below turns the refusal into "no
   * follow-up". A second check in front of it would be a branch no test can
   * distinguish: deleting it left all eighteen tests green, which is how it
   * was found. One authority on whether a balance may be billed, and it is
   * the module that draws them.
   */
  const owed = balanceDue(money(invoice.currency, invoice.totalMinor), deductions)

  /*
   * THE ONE IT TAKES OVER FROM. A live follow-up exists on every instalment
   * after the first; naming it here is what keeps exactly one of them asking.
   */
  const live = liveFollowUpFor(invoice.id, documents)

  try {
    return {
      receipt,
      balance: {
        fields: balanceInvoiceDraft({
          invoice,
          deductions,
          today,
          ...(live === undefined ? {} : { replacesId: live.id }),
        }),
        /*
         * Keyed on the invoice AND the remaining balance (§M): pressing twice
         * makes one document, and the NEXT instalment — a different
         * remainder — is a different act with a key of its own rather than
         * silently returning the previous one.
         */
        key: billBalanceKeyFor(invoice.id, owed.minor),
      },
    }
  } catch (cause) {
    /*
     * A refusal is not a failure of the payment. The money arrived; this
     * invoice simply has no balance anyone may bill — it was cancelled, or it
     * is not the type that carries one. The receipt still stands.
     */
    if (cause instanceof BillBalanceError) return { receipt, balance: null }
    throw cause
  }
}
