/**
 * The one thing a row offers to do (§G, §V).
 *
 * §G's list page is a page of documents, and the commonest next move for a
 * row is not "open it and read it" — it is "the money came in" or "they
 * signed for it". Making somebody open a document to reach a button they were
 * always going to press is three taps for one decision.
 *
 * ONE ACTION, NEVER TWO. A row is a row: the moment it carries a choice it
 * stops being scannable, and a list of forty becomes forty small decisions.
 * So this returns at most one, and only where the answer is not in doubt.
 *
 * AND IT NEVER CHANGES A STATUS. This is the rule the whole module exists to
 * hold: every action here NAVIGATES — to the payment flow, to the signing
 * sheet — and the status moves only when somebody completes the thing they
 * were taken to. A list row that marks an invoice paid is a status changed by
 * a thumb brushing a scroll, on the one screen where the document itself is
 * not in front of anybody. §V's evidence rules say a receipt records a real
 * payment; a row cannot know about one.
 *
 * DERIVED, NEVER STORED. The offer follows from the document's state at read
 * time, like every other derived state in the app (Rule #3 and §E's "derived
 * financial states are computed"). Nothing persists "this row offers Sign".
 */

import type { DocumentType } from '../../domain/documents/types'

/** What a row's button does when pressed. Both are journeys, not writes. */
export type RowActionKind = 'record_payment' | 'sign'

export interface RowActionable {
  readonly type: DocumentType
  /** The DERIVED state the list already computes — 'paid', 'overdue', … */
  readonly status: string
}

/**
 * Statuses where money is still owed on an invoice.
 *
 * Not "anything that is not paid": a draft has asked for nothing, a void has
 * been withdrawn, and a balance billed elsewhere is somebody else's row now —
 * offering to record a payment against any of those invites a payment the
 * ledger would have to refuse or, worse, accept against the wrong debt.
 */
const OWES = new Set(['unpaid', 'partially_paid', 'overdue', 'issued', 'sent'])

/**
 * Deliveries that have not been signed for yet.
 *
 * `delivered` is terminal and already carries its evidence (§P): offering to
 * sign again would invite a second mark over a document that is finished.
 */
const UNSIGNED = new Set(['issued', 'dispatched', 'in_transit', 'sent'])

/** The action this row offers, or none. */
export function rowActionFor(document: RowActionable): RowActionKind | null {
  if (document.type === 'invoice' && OWES.has(document.status)) return 'record_payment'
  if (document.type === 'waybill' && UNSIGNED.has(document.status)) return 'sign'
  return null
}
