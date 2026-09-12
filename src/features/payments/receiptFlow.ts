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
}): ReceiptRecordFields {
  const { payment } = input
  return {
    type: 'receipt',
    status: 'draft',
    currency: payment.amount.currency,
    lineItems: [
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
    issueDate: payment.paidAt.slice(0, 10),
    customerId: payment.customerId,
    paymentId: payment.id,
    ...(input.linkedInvoiceId === undefined ? {} : { linkedInvoiceId: input.linkedInvoiceId }),
  }
}

/**
 * The idempotency handle for the receipt of one payment.
 *
 * Derived, like the recurrence and conversion keys: the same payment asked for
 * a receipt twice yields one receipt (§M — retried creates never duplicate).
 */
export const receiptKeyFor = (paymentId: string): string => `rct:${paymentId}`

/** Which invoices a payment could reasonably settle, for the picker (§G). */
export interface SettleableInvoice {
  readonly id: string
  readonly customerId: string
  readonly reference: string
  readonly outstanding: Money
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
