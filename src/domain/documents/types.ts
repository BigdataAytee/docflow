/**
 * The internal document vocabulary. v6 §D: "a delivery document is always
 * `type: "waybill"` in the database everywhere on Earth; only presentation
 * adapts." Nothing in this file is ever shown to a user — display names come
 * from `src/domain/locale`.
 */

export const DOCUMENT_TYPES = ['invoice', 'quotation', 'receipt', 'waybill'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

/** Delivery documents carry no money anywhere (§G, §I, §V). */
export const carriesMoney = (type: DocumentType): boolean => type !== 'waybill'

/**
 * Stored statuses, per type. Derived financial states (unpaid, partially_paid,
 * paid, overdue, expired) are NOT here — they are computed at read time from
 * dated documents and effective ledger entries (§C).
 */
export const DOCUMENT_STATUSES = {
  invoice: ['draft', 'issued', 'sent', 'void'],
  quotation: ['draft', 'issued', 'sent', 'accepted', 'rejected', 'void'],
  receipt: ['draft', 'issued', 'void'],
  waybill: ['draft', 'issued', 'dispatched', 'in_transit', 'delivered', 'void'],
} as const

export type DocumentStatus<T extends DocumentType = DocumentType> =
  (typeof DOCUMENT_STATUSES)[T][number]

/** Derived payment state of an invoice — computed, never stored as truth. */
export type PaymentState = 'unpaid' | 'partially_paid' | 'paid' | 'overdue'

/** Derived state of a quotation. */
export type QuotationState = 'open' | 'accepted' | 'rejected' | 'expired'

/**
 * The labels frozen into a document at issue (§D.2, §M). Once set, a later
 * region change, sync or edit never rewrites them — a shared PDF does not
 * silently change language.
 */
export interface FrozenLabels {
  readonly printedTitle: string
  readonly partyLabel: string
  readonly signatureCaption: string
  readonly language: string
}

/** A line item as the money layer sees it. */
export interface LineItem {
  readonly id: string
  readonly description: string
  /** Quantity in milli-units, so 2.5 bags is 2_500. Integer, never a float. */
  readonly quantityMilli: number
  /** Unit price in minor units. Absent on waybill lines, which carry no money. */
  readonly unitPriceMinor?: number
  /** Whether this line is in the tax base (§E line_items.tax_flag). */
  readonly taxable: boolean
}

export const QUANTITY_SCALE = 1000

/** 3 bags -> 3_000. Rejects a quantity finer than the scale can hold exactly. */
export function quantity(units: number): number {
  const milli = units * QUANTITY_SCALE
  const rounded = Math.round(milli)
  if (!Number.isFinite(milli) || Math.abs(milli - rounded) > 1e-9) {
    throw new RangeError(`Quantity ${units} is finer than ${QUANTITY_SCALE} subdivisions.`)
  }
  if (rounded < 0) throw new RangeError(`Quantity ${units} cannot be negative.`)
  return rounded
}
