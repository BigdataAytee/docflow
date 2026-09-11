/**
 * Document lifecycle. v6 Rule #5 (CLAUDE.md) — issued documents are immutable.
 * Reference, totals, labels and language freeze at issue; corrections are
 * void / credit / reissue; sync must never rewrite them (§M).
 */

import {
  type DocumentStatus,
  type DocumentType,
  type PaymentState,
  type QuotationState,
  DOCUMENT_STATUSES,
} from './types'
import { type Money, isPositive, isZero, compare } from '../money/money'

type Transitions = Readonly<Record<string, readonly string[]>>

/**
 * Allowed stored-status transitions. Everything absent is denied — the server
 * revalidates against this same table and rejects invalid transitions (§P).
 */
const TRANSITIONS: Readonly<Record<DocumentType, Transitions>> = {
  invoice: {
    draft: ['issued', 'void'],
    issued: ['sent', 'void'],
    sent: ['void'],
    void: [],
  },
  quotation: {
    draft: ['issued', 'void'],
    issued: ['sent', 'accepted', 'rejected', 'void'],
    sent: ['accepted', 'rejected', 'void'],
    accepted: ['void'],
    rejected: ['void'],
    void: [],
  },
  receipt: {
    draft: ['issued', 'void'],
    issued: ['void'],
    void: [],
  },
  waybill: {
    draft: ['issued', 'void'],
    issued: ['dispatched', 'void'],
    dispatched: ['in_transit', 'delivered', 'void'],
    in_transit: ['delivered', 'void'],
    delivered: [],
    void: [],
  },
}

export const isStatusOf = (type: DocumentType, status: string): boolean =>
  (DOCUMENT_STATUSES[type] as readonly string[]).includes(status)

export function canTransition(type: DocumentType, from: string, to: string): boolean {
  if (!isStatusOf(type, from) || !isStatusOf(type, to)) return false
  return (TRANSITIONS[type][from] ?? []).includes(to)
}

export class LifecycleError extends Error {}

export function assertTransition(type: DocumentType, from: string, to: string): void {
  if (!canTransition(type, from, to)) {
    throw new LifecycleError(
      `A ${type} cannot go from "${from}" to "${to}". Corrections are void-and-reissue or a credit note (v6 §C).`,
    )
  }
}

/** A draft is the only editable state. Everything else is evidence. */
export const isDraft = (status: string): boolean => status === 'draft'

/**
 * Issued documents are frozen. Sync applies no field update to one of these;
 * delivery evidence and payment events are never silently overwritten (§M).
 */
export const isImmutable = (type: DocumentType, status: string): boolean =>
  isStatusOf(type, status) && !isDraft(status)

/** Delivery evidence, once captured, cannot be altered by a later link use (§P). */
export const isEvidenceSealed = (type: DocumentType, status: string): boolean =>
  type === 'waybill' && status === 'delivered'

/**
 * The derived payment state of an invoice. Computed from the dated document and
 * its effective ledger entries — never stored as truth (§C).
 */
export function deriveInvoiceState(input: {
  readonly status: DocumentStatus<'invoice'>
  readonly total: Money
  readonly outstanding: Money
  readonly dueDate?: string
  readonly asOf: string
}): PaymentState {
  const { total, outstanding, dueDate, asOf } = input

  if (isZero(outstanding) && !isZero(total)) return 'paid'
  if (dueDate !== undefined && asOf > dueDate && isPositive(outstanding)) return 'overdue'
  if (compare(outstanding, total) < 0 && isPositive(outstanding)) return 'partially_paid'
  return 'unpaid'
}

/** The derived state of a quotation — `expired` is a date, not a stored flag. */
export function deriveQuotationState(input: {
  readonly status: DocumentStatus<'quotation'>
  readonly validUntil?: string
  readonly asOf: string
}): QuotationState {
  const { status, validUntil, asOf } = input
  if (status === 'accepted') return 'accepted'
  if (status === 'rejected') return 'rejected'
  if (validUntil !== undefined && asOf > validUntil) return 'expired'
  return 'open'
}

/**
 * What a document needs before it may be issued (§G step 5). Draft saving is
 * always allowed — this gate applies at final issue only, and never to a draft.
 */
export interface IssueRequirements {
  readonly needsPaymentMethod: boolean
  readonly needsRecordedPayment: boolean
  readonly needsSignature: boolean
}

export function issueRequirements(type: DocumentType): IssueRequirements {
  switch (type) {
    case 'invoice':
      return { needsPaymentMethod: true, needsRecordedPayment: false, needsSignature: false }
    case 'receipt':
      // A receipt is evidence of a payment: never issued without one (§K, §V).
      return { needsPaymentMethod: false, needsRecordedPayment: true, needsSignature: false }
    case 'quotation':
    case 'waybill':
      return { needsPaymentMethod: false, needsRecordedPayment: false, needsSignature: false }
  }
}
