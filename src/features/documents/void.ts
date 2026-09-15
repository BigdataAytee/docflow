/**
 * Voiding a document (Rule #5, §G, §M).
 *
 * Rule #5: "Issued documents are immutable. Corrections are void/credit/
 * reissue." Void is the first of those three, and it is the blunt one: the
 * whole document was a mistake, or the sale is off.
 *
 * Two rules here are about money, and both are the kind that turn a bookkeeping
 * app into a liability if they go the wrong way:
 *
 *  · **An invoice with money against it is never voided.** The money came in.
 *    Voiding the invoice would leave a payment allocated to a document that
 *    officially never existed — the customer's balance would be wrong and the
 *    owner would have no idea why. The answer is a CREDIT NOTE for what is no
 *    longer owed, or reversing the payment first if it was recorded in error.
 *    `reasonsVoidIsBlocked` says which, in the owner's terms.
 *  · **Voiding a receipt never touches the payment.** A receipt is a view of a
 *    payment (§G), so cancelling the paper cannot un-receive the money. §V
 *    says reissuing a receipt never increments income; voiding one must not
 *    decrement it either. The payment stands; only the document is cancelled.
 *
 * And a void is never an edit: the record keeps its reference, its frozen
 * labels and its totals, and only its status moves (§M — issued financial
 * documents are never silently overwritten).
 */

import { type DocumentType } from '../../domain/documents/types'
import { canTransition } from '../../domain/documents/lifecycle'
import { type Money, isPositive } from '../../domain/money/money'
import { type CreditNote, type Payment, effectivePayments, paidAgainstInvoice } from '../../domain/payments/ledger'

export class VoidError extends Error {}

/** Why a void is refused, as a token the UI resolves into words (§S). */
export type VoidBlocker = 'already_void' | 'not_a_transition' | 'money_received'

export interface VoidableDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly currency: string
  readonly total: Money
}

/**
 * What stops this document being voided, in the order the owner should hear it.
 * Empty means it can be voided.
 */
export function reasonsVoidIsBlocked(
  document: VoidableDocument,
  payments: readonly Payment[],
): VoidBlocker[] {
  if (document.status === 'void') return ['already_void']
  if (!canTransition(document.type, document.status, 'void')) return ['not_a_transition']

  // Only an invoice can have money allocated against it. A receipt's payment
  // belongs to the ledger, not to the receipt (see the note above).
  if (document.type === 'invoice') {
    const paid = paidAgainstInvoice(document.id, document.currency, payments)
    if (isPositive(paid)) return ['money_received']
  }

  return []
}

export const canVoid = (document: VoidableDocument, payments: readonly Payment[]): boolean =>
  reasonsVoidIsBlocked(document, payments).length === 0

export interface VoidRequest {
  readonly document: VoidableDocument
  readonly payments: readonly Payment[]
  readonly at: string
}

export interface VoidDecision {
  readonly documentId: string
  readonly to: 'void'
  readonly at: string
  /**
   * What voiding this does NOT do, stated rather than assumed. A receipt's
   * payment survives; §V's "a receipt never moves income" cuts both ways.
   */
  readonly leavesPaymentsAlone: boolean
}

export function voidDocument(request: VoidRequest): VoidDecision {
  const blockers = reasonsVoidIsBlocked(request.document, request.payments)
  if (blockers.length > 0) {
    throw new VoidError(`This cannot be cancelled: ${blockers.join(', ')}.`)
  }

  /*
   * NO REASON IS ASKED FOR, and the one this used to demand was a Rule #1
   * violation with nothing to show for it.
   *
   * It blocked the button until something was typed, then threw the text
   * away: there is no `void_reason` column in §E, nothing writes one, and the
   * call site persists the STATUS alone. v6 never asks for a reason and
   * neither does the reference. So it was a required field that existed only
   * to be discarded — "No new required fields, ever" (Rule #1), and this was
   * a new one.
   *
   * What the sheet is actually for survives: saying that cancelling is not a
   * delete, that it never touches money already recorded, and refusing
   * outright when money HAS arrived. That refusal is the protection; a
   * sentence nobody stores was never adding to it.
   */
  return Object.freeze({
    documentId: request.document.id,
    to: 'void' as const,
    at: request.at,
    leavesPaymentsAlone: true,
  })
}

/**
 * What the owner should do instead, when a void is blocked by money.
 *
 * Not a vague "you can't": the two real routes, so the amber notice can offer
 * them rather than dead-ending.
 */
export type VoidAlternative = 'credit_the_balance' | 'reverse_the_payment'

export function alternativesFor(
  document: VoidableDocument,
  payments: readonly Payment[],
  creditNotes: readonly CreditNote[] = [],
): VoidAlternative[] {
  if (!reasonsVoidIsBlocked(document, payments).includes('money_received')) return []

  const alternatives: VoidAlternative[] = ['reverse_the_payment']

  // Crediting only helps while something is still owed; a fully settled
  // invoice has no balance to credit, and offering it would waste a tap.
  const credited = creditNotes
    .filter((note) => note.invoiceId === document.id)
    .reduce((total, note) => total + note.amount.minor, 0)
  const paid = paidAgainstInvoice(document.id, document.currency, payments)
  if (document.total.minor - paid.minor - credited > 0) {
    alternatives.unshift('credit_the_balance')
  }

  return alternatives
}

/** Payments that would be left dangling — shown so the refusal is concrete. */
export function paymentsAgainst(
  documentId: string,
  payments: readonly Payment[],
): Payment[] {
  return effectivePayments(payments).filter((payment) =>
    payment.allocations.some((allocation) => allocation.invoiceId === documentId),
  )
}
