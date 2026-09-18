/**
 * Receipts, which are evidence of payments (§G, §K, §V).
 *
 * §G: "A receipt is evidence of a payment: starting one from Home records a
 * payment first, optionally linked to an invoice or standing alone, never
 * inventing a duplicate invoice. Originals are never altered; links persist."
 *
 * Every rule here follows from that one sentence:
 *
 *  · **The payment comes first, always.** There is no function in this file
 *    that produces a receipt from an amount. `receiptDraftFor` takes a payment
 *    that already exists, so a receipt can never be the thing that records
 *    money — which is what makes §V's "issuing or resharing a receipt never
 *    increments income" structural rather than a promise.
 *  · **Standing alone means no allocation, not a new invoice.** A payment with
 *    an empty `allocations` list is customer money with nothing to settle
 *    (§K's customer credit). Inventing an invoice to hang it on would bill
 *    somebody for a sale that never happened.
 *  · **One receipt per payment.** §G gives each payment "its own Receipt
 *    button"; tapping it twice should open the receipt that exists, not mint a
 *    second piece of evidence for one event. The link is read off the receipt
 *    (`paymentId`), so nothing is written back to the payment — the same shape
 *    as `convertedFromId`.
 *  · **A reversal has no receipt.** Nothing was handed over, so there is
 *    nothing to acknowledge; `receiptDraftFor` already refuses.
 */

import type { DocumentType, LineItem } from '../../domain/documents/types'
import { quantity } from '../../domain/documents/types'
import { type Money, isPositive } from '../../domain/money/money'
import { type Payment, LedgerError, effectivePayments } from '../../domain/payments/ledger'
import { type ReceiptDraft, receiptDraftFor, recordPayment } from './record'
import { localDay } from '../../domain/dates/calendar'

/**
 * Carries a token, not a sentence. The words the owner reads come from the
 * language catalogue (§S); this layer holds no English, which is also what
 * keeps the Rule-4 lint rule satisfied without an exemption.
 */
export class ReceiptFlowError extends Error {
  constructor(
    readonly field: 'no_such_payment' | 'amount',
    message: string,
  ) {
    super(message)
    this.name = 'ReceiptFlowError'
  }
}

/** What this file needs of a document to find receipts among them. */
export interface ReceiptCandidate {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly paymentId?: string
}

/**
 * The receipt already issued for this payment, or null.
 *
 * A voided receipt does not count: the evidence was cancelled, so §G's
 * "void and reissue" needs somewhere to go.
 */
export function receiptForPayment(
  documents: readonly ReceiptCandidate[],
  paymentId: string,
): ReceiptCandidate | null {
  return (
    documents.find(
      (document) =>
        document.type === 'receipt' &&
        document.paymentId === paymentId &&
        document.status !== 'void',
    ) ?? null
  )
}

/** Payments with no receipt yet — what the saved invoice offers a button for. */
export function paymentsAwaitingReceipt(
  payments: readonly Payment[],
  documents: readonly ReceiptCandidate[],
): Payment[] {
  return effectivePayments(payments).filter(
    (payment) => receiptForPayment(documents, payment.id) === null,
  )
}

/**
 * The draft for a receipt against a payment that already exists.
 *
 * Throws rather than inventing anything when the payment is not there: a
 * receipt for a payment nobody recorded is a receipt for money nobody paid.
 */
export function receiptFor(
  payments: readonly Payment[],
  paymentId: string,
): ReceiptDraft {
  const payment = payments.find((row) => row.id === paymentId)
  if (payment === undefined) {
    throw new ReceiptFlowError(
      'no_such_payment',
      `No payment ${paymentId}. Evidence of money needs the money recorded first (v6 §G).`,
    )
  }
  // Refuses a reversal: nothing was handed over to acknowledge.
  return receiptDraftFor(payment)
}

export interface NewReceiptInput {
  readonly paymentId: string
  readonly customerId: string
  readonly amount: Money
  readonly paidAt: string
  readonly method: string
  readonly reference?: string
  /**
   * The invoice this settles, when there is one. Absent means the payment
   * stands alone — NOT that an invoice should be created for it (§G).
   */
  readonly invoiceId?: string
  readonly invoiceTotal?: Money
  readonly existingPayments?: readonly Payment[]
}

export interface NewReceipt {
  /** Recorded first. The receipt is derived from it, never the reverse. */
  readonly payment: Payment
  readonly draft: ReceiptDraft
  /** Derived from the payment, so a retry is one payment and one receipt (§M). */
  readonly paymentKey: string
  readonly receiptKey: string
}

/**
 * §G's "starting one from Home records a payment first".
 *
 * The payment is built through `recordPayment`, so every ledger rule applies:
 * allocations never exceed the balance, over-payment becomes customer credit
 * rather than a larger allocation, and currencies never mix.
 */
export function startReceipt(input: NewReceiptInput): NewReceipt {
  if (!isPositive(input.amount)) {
    throw new ReceiptFlowError(
      'amount',
      'Acknowledging money received needs an amount above nothing.',
    )
  }

  let payment: Payment
  try {
    payment = recordPayment({
      id: input.paymentId,
      customerId: input.customerId,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method,
      ...(input.reference === undefined ? {} : { reference: input.reference }),
      // Absent invoice means a standalone payment: no allocation, and
      // emphatically no invented invoice (§G).
      ...(input.invoiceId === undefined ? {} : { invoiceId: input.invoiceId }),
      ...(input.invoiceTotal === undefined ? {} : { invoiceTotal: input.invoiceTotal }),
      ...(input.existingPayments === undefined ? {} : { existingPayments: input.existingPayments }),
    })
  } catch (cause) {
    // The ledger's own refusals, passed through rather than reworded — they
    // already say what is wrong in terms of money.
    if (cause instanceof LedgerError) throw cause
    throw cause
  }

  return {
    payment,
    draft: receiptDraftFor(payment),
    paymentKey: `pay:${input.paymentId}`,
    receiptKey: receiptKeyFor(input.paymentId),
  }
}

/** The stored fields of a receipt, as the repository wants them. */
export interface ReceiptRecordFields {
  readonly type: 'receipt'
  readonly status: 'draft'
  readonly currency: string
  readonly lineItems: readonly LineItem[]
  readonly totalMinor: number
  /**
   * The day the money arrived. The payment knows it, so the owner is never
   * asked to type a date the app already has (Rule #1) — and a receipt dated
   * anything other than the payment would be evidence of a different event.
   */
  readonly issueDate: string
  readonly customerId?: string
  readonly paymentId: string
  readonly linkedInvoiceId?: string
  /** What the linked invoice still owes after this payment. Frozen (Rule #5). */
  readonly balanceAfterMinor?: number
  /** The bill, and what had arrived before this payment. Frozen with it. */
  readonly invoiceTotalMinor?: number
  readonly paidBeforeMinor?: number
}

/**
 * The receipt record for one payment — the single shape both doors produce.
 *
 * One line, quantity one, priced at exactly what was handed over and NOT
 * taxable. A receipt's printed total IS the payment (§V), so it is never a sum
 * the owner types and never has tax added on top of money already received.
 * The description is passed in because the words live in the catalogue (§S).
 */
export function receiptRecordFor(input: {
  readonly payment: {
    readonly id: string
    readonly customerId: string
    readonly amount: Money
    readonly paidAt: string
  }
  readonly description: string
  readonly linkedInvoiceId?: string
  /**
   * What the invoice still owed BEFORE this payment, when there is one.
   *
   * Passed in rather than looked up: this module builds a record and knows
   * nothing about the ledger, and the caller has already asked it — the same
   * figure it capped the allocation against.
   */
  readonly invoiceOutstandingBefore?: Money
  /**
   * The invoice's own goods and its total, when this settles one.
   *
   * The receipt CARRIES THE ITEMS rather than one summary line: a customer
   * reconciling a part payment needs to see what the bill was for, and the
   * invoice they hold is the only place those words exist. Copied at issue,
   * so the receipt keeps them even if the invoice is later voided.
   */
  readonly invoiceLineItems?: readonly LineItem[]
  readonly invoiceTotal?: Money
}): ReceiptRecordFields {
  const { payment } = input
  return {
    type: 'receipt',
    status: 'draft',
    currency: payment.amount.currency,
    /*
     * THE INVOICE'S OWN GOODS, when there is an invoice.
     *
     * A receipt settling a bill shows what the bill was FOR — the customer
     * reconciling a part payment has the invoice in front of them and needs
     * the two to line up. Copied rather than referenced, so the receipt still
     * says what it was for if the invoice is later voided (Rule #5).
     *
     * A standalone receipt has no such source and keeps its one line, priced
     * at exactly what was handed over.
     */
    lineItems:
      input.invoiceLineItems !== undefined && input.invoiceLineItems.length > 0
        ? input.invoiceLineItems.map((line, index) => ({
            ...line,
            id: `${payment.id}:line:${index}`,
          }))
        : [
            {
              id: `${payment.id}:line`,
              description: input.description,
              quantityMilli: quantity(1),
              unitPriceMinor: payment.amount.minor,
              taxable: false,
            },
          ],
    totalMinor: payment.amount.minor,
    // `paidAt` is a timestamp; a document date is a day (§E).
    // The day the MONEY arrived, in the owner's calendar. Slicing the
    // instant dated the receipt in UTC, which west of Greenwich puts an
    // evening payment on tomorrow's receipt.
    issueDate: localDay(payment.paidAt),
    customerId: payment.customerId,
    paymentId: payment.id,
    ...(input.linkedInvoiceId === undefined ? {} : { linkedInvoiceId: input.linkedInvoiceId }),
    /*
     * WHAT IS LEFT AFTER THIS PAYMENT, frozen onto the receipt (§I, Rule #5).
     *
     * Never below zero: paying more than is owed settles the debt and leaves
     * the surplus as customer credit (§K), so the receipt says "Paid in full"
     * rather than reporting a negative balance nobody owes.
     *
     * Absent on a standalone receipt, which settles no debt and reports the
     * state of none — a "Balance remaining: ₦0" on a cash sale invents one.
     */
    ...(input.linkedInvoiceId === undefined || input.invoiceOutstandingBefore === undefined
      ? {}
      : input.invoiceTotal === undefined
        ? {
            balanceAfterMinor: Math.max(
              0,
              input.invoiceOutstandingBefore.minor - payment.amount.minor,
            ),
          }
        : frozenPicture({
            invoiceTotal: input.invoiceTotal,
            outstandingBefore: input.invoiceOutstandingBefore,
            paidMinor: payment.amount.minor,
          })),
  }
}

/**
 * The three frozen figures a receipt prints, worked out ONCE (§I, Rule #5).
 *
 * The live preview on Path A's page and the record that is actually written
 * both need them, and computing them twice is two chances to disagree about
 * one number — which would mean somebody signing under a balance the printed
 * receipt then contradicts. So it is one function, read twice.
 *
 * Never below zero: paying more than is owed settles the debt and leaves the
 * surplus as customer credit (§K), so the receipt says "Paid in full" rather
 * than reporting a negative balance nobody owes.
 */
export function frozenPicture(input: {
  readonly invoiceTotal: Money
  readonly outstandingBefore: Money
  readonly paidMinor: number
}): {
  readonly balanceAfterMinor: number
  readonly invoiceTotalMinor: number
  readonly paidBeforeMinor: number
} {
  return {
    balanceAfterMinor: Math.max(0, input.outstandingBefore.minor - input.paidMinor),
    invoiceTotalMinor: input.invoiceTotal.minor,
    /*
     * What had already arrived: the bill less what was still owing before
     * this payment. Derived rather than passed separately, so the three
     * figures on the printed receipt cannot fail to add up.
     */
    paidBeforeMinor: Math.max(0, input.invoiceTotal.minor - input.outstandingBefore.minor),
  }
}

/**
 * The idempotency handle for the receipt of one payment.
 *
 * Derived, like the recurrence and conversion keys: the same payment asked for
 * a receipt twice yields one receipt (§M — retried creates never duplicate).
 */
export const receiptKeyFor = (paymentId: string): string => `rct:${paymentId}`

/**
 * Which invoices a payment could reasonably settle, for the picker (§G).
 *
 * ENOUGH TO RECOGNISE ONE BY. A reference and a balance is what the picker
 * used to show, and a trader with four bills to the same customer cannot tell
 * INV-0007 from INV-0009 by their numbers — the thing they remember is what
 * the job was and roughly when. So the row carries the date, the goods and the
 * face value too, and the same set is what the receipt freezes at issue.
 */
export interface SettleableInvoice {
  readonly id: string
  readonly customerId: string
  readonly reference: string
  /** What is still owed on it, after every payment and credit note. */
  readonly outstanding: Money
  /** The day it was issued — the other half of recognising a bill. */
  readonly issueDate: string
  /** The face value, before anything was paid against it. */
  readonly total: Money
  /** Its own goods, which the picker names and the receipt carries. */
  readonly lineItems: readonly LineItem[]
}

/**
 * The picker offers only what this money could actually settle: the payer's
 * own unsettled balances, in the currency that was handed over.
 *
 * The customer filter is not cosmetic. Money from one customer allocated to
 * another's invoice would settle a debt nobody paid and leave the real one
 * standing — so an unnamed payer offers nothing, and "standing alone" is the
 * only choice until the owner says who paid.
 */
export function settleableInvoices(
  invoices: readonly SettleableInvoice[],
  customerId: string,
  currency: string,
): SettleableInvoice[] {
  if (customerId === '') return []
  return invoices
    .filter(
      (invoice) =>
        invoice.customerId === customerId &&
        invoice.outstanding.currency === currency &&
        isPositive(invoice.outstanding),
    )
    // Biggest balance first: it is the one most likely being settled.
    .sort((a, b) => b.outstanding.minor - a.outstanding.minor || a.id.localeCompare(b.id))
}
