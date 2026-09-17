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
  | 'sign'
  | 'void_or_credit'
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
   * Issued, and therefore finished (Rule #5).
   *
   * Signing an invoice AFTER issue would change a document whose reference,
   * totals and labels are frozen — corrections go forward as a void, a credit
   * note or a reissue, never by editing what was sent. So §G's invoice "sign"
   * is a thing done to a draft, and afterwards the pill says so rather than
   * quietly modifying a sent invoice.
   */
  | 'issued_is_final'

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
    case 'invoice':
      return [
        share,
        convert,
        /*
         * BEFORE ISSUE, never after. Rule #5 freezes an issued document, and
         * a signature applied afterwards changes what was sent. This reads
         * backwards against the other three — they need the document issued
         * and this one needs it not to be — which is exactly why it is worth
         * saying out loud rather than leaving as a condition.
         */
        when(!issued, 'sign', 'issued_is_final'),
        when(issued && !voided, 'void_or_credit', voided ? 'voided' : 'not_issued'),
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
        when(
          issued && input.dispatched === true,
          'copy_signing_link',
          issued ? 'not_dispatched' : 'not_issued',
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
