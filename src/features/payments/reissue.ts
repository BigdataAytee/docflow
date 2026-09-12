/**
 * Void and reissue a receipt (§G, Rule #5, §V).
 *
 * §G gives a receipt two actions, and this is the first: "void and reissue".
 * It exists because a receipt cannot be corrected any other way. It is
 * immutable once issued (Rule #5), and a credit note is an INVOICE correction
 * — crediting a receipt would mean money going back to the customer, which is
 * a refund, not a typo. So the wrong paper is cancelled and a fresh one is
 * drawn for the same payment.
 *
 * The rules:
 *
 *  · **The money never moves.** A receipt is a view of a payment (§G).
 *    Cancelling the paper cannot un-receive the cash, and drawing it again
 *    cannot receive it twice — §V: "issuing or resharing its receipt never
 *    increments income". Nothing here touches the ledger, and the value says
 *    so out loud.
 *  · **Nothing is reissued for money that is not there.** A reversed payment
 *    has nothing to acknowledge, and a receipt naming no payment has nothing
 *    to reissue from. Both are refused with a reason, because the honest
 *    action in those cases is a plain void.
 *  · **The replacement says what it replaces.** The customer is holding the
 *    cancelled one; two receipts for one payment, neither mentioning the
 *    other, is how a payment gets counted twice by the person reading them.
 *  · **A retried gesture makes one replacement** (§M). The key is derived
 *    from the receipt being replaced, not generated.
 *
 * If the void lands and the create does not, the owner is not stuck: a voided
 * receipt does not count as the payment's receipt, so the payment's own
 * Receipt button offers to draw one. The recovery path is the ordinary path.
 */

import type { DocumentType } from '../../domain/documents/types'
import { type Payment, effectivePayments } from '../../domain/payments/ledger'
import { type ReceiptRecordFields, receiptRecordFor } from './receiptFlow'

/** A token, not a sentence. The words are the catalogue's (§S, Rule #4). */
export class ReissueError extends Error {
  constructor(
    readonly field: ReissueBlocker,
    message: string,
  ) {
    super(message)
    this.name = 'ReissueError'
  }
}

export type ReissueBlocker =
  | 'not_reissuable_type'
  | 'not_issued'
  | 'already_void'
  | 'no_payment'
  | 'payment_missing'
  | 'payment_reversed'

/** What this module needs of a document. */
export interface ReissuableDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly paymentId?: string
  readonly linkedInvoiceId?: string
  readonly issuedReference?: string | null
}

/**
 * Why this document cannot be voided and reissued, or null.
 *
 * Ordered so the first reason is the most useful one to say. A draft is
 * excluded because it can simply be edited; an already-void receipt because
 * there is nothing left to cancel — its replacement comes from the payment.
 */
export function reasonsReissueIsBlocked(
  document: ReissuableDocument,
  payments: readonly Payment[],
): ReissueBlocker | null {
  if (document.type !== 'receipt') return 'not_reissuable_type'
  if (document.status === 'void') return 'already_void'
  if (document.status === 'draft') return 'not_issued'
  if (document.paymentId === undefined) return 'no_payment'

  const payment = payments.find((row) => row.id === document.paymentId)
  if (payment === undefined) return 'payment_missing'
  // A reversal nets the pair out of the effective ledger, so a payment that
  // has been reversed is simply not there. There is nothing to acknowledge,
  // and the honest action is a plain void.
  if (!effectivePayments(payments).some((row) => row.id === payment.id)) return 'payment_reversed'

  return null
}

export const canReissue = (
  document: ReissuableDocument,
  payments: readonly Payment[],
): boolean => reasonsReissueIsBlocked(document, payments) === null

/**
 * The idempotency handle for one replacement.
 *
 * Derived from the receipt being replaced, so two taps make one replacement
 * (§M) — and so it can never collide with `rct:<payment>`, which the receipt
 * being replaced was already created under.
 */
export const reissueKeyFor = (replacedReceiptId: string): string => `reissue:${replacedReceiptId}`

export interface Reissue {
  /** The receipt to cancel. Its reference, labels and totals are untouched. */
  readonly voidId: string
  /** The fresh draft, derived from the same payment. */
  readonly replacement: ReceiptRecordFields & { readonly supersedesId: string }
  readonly idempotencyKey: string
  /** §V: nothing here moves money, in either direction. */
  readonly leavesPaymentAlone: true
}

export interface ReissueOptions {
  readonly payments: readonly Payment[]
  /**
   * The line on the replacement, in the active language (§S). This module
   * holds no English — the same reason `receiptRecordFor` takes one.
   */
  readonly description: string
}

export function voidAndReissue(
  document: ReissuableDocument,
  options: ReissueOptions,
): Reissue {
  const blocked = reasonsReissueIsBlocked(document, options.payments)
  if (blocked !== null) {
    throw new ReissueError(blocked, `Document ${document.id} cannot be reissued.`)
  }

  const payment = options.payments.find((row) => row.id === document.paymentId)
  if (payment === undefined) {
    // Unreachable: the guard above already established it. Kept because a
    // receipt for money nobody paid is the one thing this must never build.
    throw new ReissueError('payment_missing', `No payment ${String(document.paymentId)}.`)
  }

  return {
    voidId: document.id,
    replacement: {
      // The same payment, through the same builder both other doors use — so
      // a reissued receipt and a first one cannot disagree about what a
      // receipt for one payment looks like.
      ...receiptRecordFor({
        payment,
        description: options.description,
        ...(document.linkedInvoiceId === undefined
          ? {}
          : { linkedInvoiceId: document.linkedInvoiceId }),
      }),
      supersedesId: document.id,
    },
    idempotencyKey: reissueKeyFor(document.id),
    leavesPaymentAlone: true,
  }
}
