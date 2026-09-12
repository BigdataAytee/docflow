/**
 * The customer's answer to a quotation (§G, §P).
 *
 * §G gives a quotation a "copy accept link" so the customer can answer on
 * their own phone. That page is Phase 5 — it needs a deployed edge function,
 * because a customer is not signed in and RLS scopes every read to a company
 * (§P). But the ANSWER is not a Phase 5 idea: most customers say yes on the
 * phone, or in the shop, or on WhatsApp, and Rule #3 says offline is the
 * product. So recording it belongs here, and the link becomes a second way in
 * rather than the only one.
 *
 * Until this, `accepted` and `rejected` existed in the lifecycle, in the type
 * table, in `deriveQuotationState` and in `convert.ts`'s list of statuses a
 * quotation may be converted from — and nothing in the app could reach either.
 *
 * The rules:
 *
 *  · **An answer is a status change, never an edit.** Reference, labels and
 *    totals are untouched (Rule #5); the same `transition` every other status
 *    move goes through, so the lifecycle table stays the single authority on
 *    what may follow what.
 *  · **An answer is final.** The lifecycle lets an answered quotation go to
 *    `void` and nowhere else, and that is right rather than restrictive: an
 *    accepted offer may already have become an invoice, and flipping it back
 *    to "turned down" would erase the fact it was accepted while the invoice
 *    it produced still stood. A customer who changes their mind gets the
 *    correction §G already gives a quotation — withdraw it, or send Rev 2.
 *    §P has the server revalidate against this same table, so a rule invented
 *    here to be convenient would simply be rejected on sync.
 *  · **An expired offer is answered as it stands.** `expired` is derived from
 *    a date, not stored (Rule #3), so an offer past its validity is still
 *    `sent` underneath and can still be accepted. Whether to honour an old
 *    price is the owner's call, not the app's.
 */

import type { DocumentType } from '../../domain/documents/types'
import { canTransition } from '../../domain/documents/lifecycle'

/** A token, not a sentence. The words are the catalogue's (§S, Rule #4). */
export class AnswerError extends Error {
  constructor(
    readonly field: AnswerBlocker,
    message: string,
  ) {
    super(message)
    this.name = 'AnswerError'
  }
}

export type Answer = 'accepted' | 'rejected'
export type AnswerBlocker =
  | 'not_a_quotation'
  | 'not_issued'
  | 'void'
  | 'already_answered'

export interface AnswerableDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
}

/**
 * Why this offer cannot be answered that way, or null.
 *
 * A draft has not been made to anybody yet, a withdrawn offer is no longer on
 * the table, and an offer already answered stays answered — each gets its own
 * token so the screen can say which, rather than one blank refusal.
 */
export function reasonsAnswerIsBlocked(
  document: AnswerableDocument,
  answer: Answer,
): AnswerBlocker | null {
  if (document.type !== 'quotation') return 'not_a_quotation'
  if (document.status === 'void') return 'void'
  if (isAnswer(document.status)) return 'already_answered'
  if (!canTransition(document.type, document.status, answer)) return 'not_issued'
  return null
}

const isAnswer = (status: string): status is Answer =>
  status === 'accepted' || status === 'rejected'

/** The answer already on this offer, or null. */
export const answerOn = (document: AnswerableDocument): Answer | null =>
  isAnswer(document.status) ? document.status : null

export const canAnswer = (document: AnswerableDocument, answer: Answer): boolean =>
  reasonsAnswerIsBlocked(document, answer) === null

/** Both answers this offer could be given right now. Empty means none. */
export function answersFor(document: AnswerableDocument): Answer[] {
  return (['accepted', 'rejected'] as const).filter((answer) => canAnswer(document, answer))
}

export interface AnsweredQuotation {
  readonly documentId: string
  readonly to: Answer
  /** Rule #5: an answer moves the status and nothing else. */
  readonly isStatusOnly: true
}

export function answerQuotation(
  document: AnswerableDocument,
  answer: Answer,
): AnsweredQuotation {
  const blocked = reasonsAnswerIsBlocked(document, answer)
  if (blocked !== null) {
    throw new AnswerError(blocked, `Document ${document.id} cannot be answered "${answer}".`)
  }
  return Object.freeze({ documentId: document.id, to: answer, isStatusOnly: true })
}
