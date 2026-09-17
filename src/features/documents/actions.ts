/**
 * The four actions a saved document offers (§G, §N).
 *
 * §G is explicit: "**Actions**, four per type: share PDF / convert / sign /
 * void-or-credit-note (invoice); copy accept link / duplicate as Rev 2
 * (quotation); void and reissue / open invoice (receipt); copy signing link /
 * add photo (delivery)."
 *
 * The screen had grown a COLUMN instead — a different set of full-width
 * buttons appearing and disappearing as the delivery lifecycle advanced, plus
 * a proof-of-delivery card underneath. The reasoning behind that was sound and
 * is kept: something that never left cannot have arrived (§M), so a signing
 * link genuinely cannot exist before the goods have gone. What was wrong was
 * the conclusion. A control that is not yet possible does not have to vanish;
 * §N says an unavailable capability is SAID, and a grid that keeps its shape
 * while one pill explains itself tells an owner more than a grid that silently
 * grows a button on Thursday.
 *
 * So: always four, in a fixed order, each either live or disabled with the
 * reason it is not. The layout stops moving under the owner's thumb, and the
 * lifecycle stays exactly as strict as it was.
 */

import type { DocumentType } from '../../domain/documents/types'

export type ActionId =
  | 'share_pdf'
  | 'convert'
  | 'record_payment'
  | 'chase'
  | 'copy_accept_link'
  | 'duplicate_rev2'
  | 'void_and_reissue'
  | 'open_invoice'
  | 'copy_signing_link'
  | 'add_photo'

/**
 * Why an action is not available yet.
 *
 * Every one of these is a FACT about the document, not a apology. They exist
 * so the pill can say the reason rather than sit greyed out and unexplained,
 * which is the failure §N names.
 */
export type ActionBlocker =
  /** Still a draft: nothing is frozen, so there is nothing to send or link to. */
  | 'not_issued'
  /** The goods have not left. A signing link would point at nothing (§M). */
  | 'not_dispatched'
  /** Signed for. A photo added afterwards would change what the record says (§P). */
  | 'sealed'
  /** Already void; Rule #5 says corrections go forward, never backward. */
  | 'voided'
  /** This receipt stands alone — there is no invoice behind it to open. */
  | 'no_invoice'
  /** §G's convert list has no target for this type. */
  | 'nothing_to_convert'
  /**
   * Nothing is owed on it.
   *
   * Kept as a REASON rather than a hidden pill: the two money actions stay in
   * their places so the grid does not change shape, and a settled invoice is
   * a fact worth reading rather than an absence to infer.
   */
  | 'nothing_owed'

export interface DocumentAction {
  readonly id: ActionId
  readonly enabled: boolean
  /** Present exactly when `enabled` is false. */
  readonly blockedBy?: ActionBlocker
}

export interface ActionInput {
  readonly type: DocumentType
  readonly status: string
  /** Deliveries: whether the goods have actually gone out (§M). */
  readonly dispatched?: boolean
  /** Deliveries: whether the customer has signed for them. */
  readonly signed?: boolean
  /** Receipts: the invoice this is evidence against, if it has one. */
  readonly linkedInvoiceId?: string
  /** Invoices: whether anything is still outstanding on it. */
  readonly owes?: boolean
}

/** §G's convert list: quote → invoice/delivery; invoice → delivery; delivery → invoice. */
const CONVERTS: Readonly<Record<DocumentType, boolean>> = {
  quotation: true,
  invoice: true,
  waybill: true,
  // "A receipt is evidence of a payment" — there is nothing to turn it into.
  receipt: false,
}

const allow = (id: ActionId): DocumentAction => ({ id, enabled: true })
const block = (id: ActionId, blockedBy: ActionBlocker): DocumentAction => ({
  id,
  enabled: false,
  blockedBy,
})

const when = (ok: boolean, id: ActionId, blockedBy: ActionBlocker): DocumentAction =>
  ok ? allow(id) : block(id, blockedBy)

/**
 * Exactly four, in a fixed order, for any document.
 *
 * The tuple type is the point: §G says four, and a return type that permits
 * three makes "four per type" a comment rather than a rule.
 */
export function documentActions(
  input: ActionInput,
): readonly [DocumentAction, DocumentAction, DocumentAction, DocumentAction] {
  const issued = input.status !== 'draft'
  const voided = input.status === 'void'

  /*
   * A draft has no frozen reference and no issued page, so nothing that
   * produces or points at one can work yet. This is the single most common
   * reason a pill is dark, and it is the same reason for every type.
   */
  const share = when(issued, 'share_pdf', 'not_issued')
  const convert = !CONVERTS[input.type]
    ? block('convert', 'nothing_to_convert')
    : when(issued, 'convert', 'not_issued')

  switch (input.type) {
    /*
     * An invoice is about MONEY ARRIVING, so its four are the four acts that
     * move money: send it, turn it into something else, take the payment,
     * ask for it.
     *
     * §G's list named "sign" and "void-or-credit-note" instead, and both are
     * gone at the owner's instruction. Neither is lost: signing happens in the
     * builder, where Rule #5 allows it, and voiding is a CORRECTION — it sits
     * behind More with the credit note, which is where Rule #5's "corrections
     * go forward" belongs rather than in the same row as Share PDF.
     *
     * Recording a payment is also the only honest route to a receipt. §G:
     * "A receipt is evidence of a payment... never inventing a duplicate
     * invoice" — so a receipt is produced by money arriving, not by
     * converting the request for it.
     */
    case 'invoice':
      return [
        share,
        convert,
        when(issued && !voided && input.owes === true, 'record_payment', voided ? 'voided' : issued ? 'nothing_owed' : 'not_issued'),
        when(issued && !voided && input.owes === true, 'chase', voided ? 'voided' : issued ? 'nothing_owed' : 'not_issued'),
      ]

    case 'quotation':
      return [
        share,
        convert,
        when(issued, 'copy_accept_link', 'not_issued'),
        when(issued, 'duplicate_rev2', 'not_issued'),
      ]

    case 'receipt':
      return [
        share,
        convert,
        when(issued && !voided, 'void_and_reissue', voided ? 'voided' : 'not_issued'),
        when(
          input.linkedInvoiceId !== undefined && input.linkedInvoiceId !== '',
          'open_invoice',
          'no_invoice',
        ),
      ]

    case 'waybill':
      return [
        share,
        /*
         * THE LIFECYCLE CLAUSE, kept whole. Something that never left cannot
         * have arrived (§M): the link a customer signs cannot exist until the
         * goods have gone. It is dark and says so, rather than absent.
         */
        /*
         * ONCE. A delivery that has been signed for cannot be signed again,
         * and that is §P's rule rather than a preference: evidence is
         * captured once, `delivered` is terminal, and a second signature
         * would overwrite the first while the customer holding the earlier
         * PDF had no way to know it had changed.
         *
         * So the pill goes dark and says the record is sealed — the same
         * answer the repository gives, in the place somebody would ask.
         */
        when(
          issued && input.dispatched === true && input.signed !== true,
          'copy_signing_link',
          input.signed === true ? 'sealed' : issued ? 'not_dispatched' : 'not_issued',
        ),
        convert,
        /*
         * A photo added after the customer signed would change what the
         * record says happened (§P), so signing seals it.
         */
        when(issued && input.signed !== true, 'add_photo', issued ? 'sealed' : 'not_issued'),
      ]
  }
}
