/**
 * The legacy status enum, mapped to the new per-type statuses (§Q Phase 7).
 *
 * §Q: "17-value status enum mapped to per-type statuses; counts and totals
 * reconciled to the naira; migrated documents assigned EN-NG frozen labels
 * matching what they were issued with."
 *
 * The legacy app kept ONE status column across all four document types, with
 * seventeen values covering every type's lifecycle at once plus three that are
 * not lifecycle states at all. The new model has a status set per type
 * (`src/domain/documents/lifecycle.ts`), so the mapping is not a rename — it
 * is a decision about what each old value MEANT.
 *
 * Three of them are the interesting ones, and they are the reason this file
 * exists rather than a lookup table:
 *
 *   **paid, partially_paid, overdue** are not statuses in the new model at
 *   all. CLAUDE.md: "Derived states (paid, overdue, expired) are computed at
 *   read time, never stored as truth." So they map to `issued` PLUS the
 *   payment that made them true — and if the migration wrote the status and
 *   dropped the payment, every one of those invoices would arrive looking
 *   unpaid. That is the single worst thing this migration could do, because it
 *   is silent: the documents are all there, the totals are all there, and the
 *   business's receivables are wrong.
 *
 * Nothing here guesses. A legacy value with no honest mapping is refused, and
 * the account does not migrate until a person decides.
 */

import type { DocumentType } from '../../src/domain/documents/types'

export const LEGACY_STATUSES = [
  'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled',
  'accepted', 'rejected', 'pending', 'packed', 'dispatched', 'in_transit',
  'delivered', 'returned', 'to_be_signed', 'to_be_delivered',
] as const

export type LegacyStatus = (typeof LEGACY_STATUSES)[number]

export interface Mapped {
  readonly status: string
  /**
   * True when the legacy value described MONEY rather than a lifecycle state.
   * The caller must then carry `paid_amount` across as a payment, or the
   * document arrives looking unpaid.
   */
  readonly impliesPayment: boolean
  /** Why, for the reconciliation report a person reads before cutover. */
  readonly note?: string
}

export class UnmappableStatus extends Error {
  constructor(readonly type: DocumentType, readonly status: string) {
    super(`No honest mapping for a ${type} with legacy status "${status}".`)
    this.name = 'UnmappableStatus'
  }
}

/**
 * Per TYPE, because the same word meant different things.
 *
 * `sent` on an invoice is the new `sent`; on a waybill it is `dispatched`.
 * One table keyed only by the old value would have to pick one and be wrong
 * for the other.
 */
const MAP: Readonly<Record<DocumentType, Partial<Record<LegacyStatus, Mapped>>>> = {
  invoice: {
    draft: { status: 'draft', impliesPayment: false },
    sent: { status: 'sent', impliesPayment: false },
    viewed: { status: 'sent', impliesPayment: false, note: 'legacy "viewed" is a sent invoice; the new model does not track opens' },
    // The three that are derived, not stored.
    paid: { status: 'sent', impliesPayment: true, note: 'paid is derived from the ledger; the payment is carried across' },
    partially_paid: { status: 'sent', impliesPayment: true, note: 'part paid is derived; the payment is carried across' },
    overdue: { status: 'sent', impliesPayment: false, note: 'overdue is derived from the due date at read time' },
    cancelled: { status: 'void', impliesPayment: false },
  },
  quotation: {
    draft: { status: 'draft', impliesPayment: false },
    sent: { status: 'sent', impliesPayment: false },
    viewed: { status: 'sent', impliesPayment: false },
    pending: { status: 'sent', impliesPayment: false, note: 'legacy "pending" on a quotation is awaiting an answer' },
    accepted: { status: 'accepted', impliesPayment: false },
    rejected: { status: 'rejected', impliesPayment: false },
    cancelled: { status: 'void', impliesPayment: false },
  },
  receipt: {
    draft: { status: 'draft', impliesPayment: false },
    // A receipt IS evidence of money, so every issued one carries its payment.
    sent: { status: 'issued', impliesPayment: true },
    paid: { status: 'issued', impliesPayment: true },
    viewed: { status: 'issued', impliesPayment: true },
    cancelled: { status: 'void', impliesPayment: false },
  },
  waybill: {
    draft: { status: 'draft', impliesPayment: false },
    packed: { status: 'issued', impliesPayment: false, note: 'legacy "packed" is an issued, undispatched delivery' },
    to_be_delivered: { status: 'issued', impliesPayment: false },
    to_be_signed: { status: 'issued', impliesPayment: false },
    sent: { status: 'dispatched', impliesPayment: false, note: 'on a delivery, legacy "sent" means it left' },
    dispatched: { status: 'dispatched', impliesPayment: false },
    in_transit: { status: 'in_transit', impliesPayment: false },
    delivered: { status: 'delivered', impliesPayment: false },
    cancelled: { status: 'void', impliesPayment: false },
    // `returned` has no new state. A returned delivery is not delivered, and
    // it is not void either — somebody has to say which. Refused on purpose.
  },
}

export function mapStatus(type: DocumentType, status: string): Mapped {
  const mapped = MAP[type]?.[status as LegacyStatus]
  if (mapped === undefined) {
    // Never a default. A guess here writes the wrong lifecycle state onto a
    // real document and nothing downstream can tell it was guessed.
    throw new UnmappableStatus(type, status)
  }
  return mapped
}

/** Every (type, status) pair the legacy data can contain, for coverage. */
export function coverage(): { type: DocumentType; status: LegacyStatus; mapped: boolean }[] {
  const types: DocumentType[] = ['invoice', 'quotation', 'receipt', 'waybill']
  return types.flatMap((type) =>
    LEGACY_STATUSES.map((status) => ({
      type,
      status,
      mapped: MAP[type]?.[status] !== undefined,
    })),
  )
}
