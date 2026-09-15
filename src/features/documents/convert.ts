/**
 * Converting one document into another (§G, §E, §M).
 *
 * §G: "Convert offers only what makes sense — quote → invoice or delivery;
 * invoice → delivery; delivery → invoice (asks for prices, since deliveries
 * carry no money). A receipt is evidence of a payment … never inventing a
 * duplicate invoice. Originals are never altered; links persist."
 *
 * Four rules, each of which would be a bug if it went the other way:
 *
 *  · **Only what makes sense.** `CONVERSIONS` is the whole table, and it is
 *    deliberately not symmetric: an invoice becomes a delivery, a delivery
 *    becomes an invoice, and nothing becomes a quotation, because a quotation
 *    is an offer made before the work — you cannot go back and offer it.
 *  · **A receipt is never a conversion target or source.** It is evidence of a
 *    payment (§K), so it comes from the ledger and nowhere else. Converting
 *    *into* one would create money nothing was paid for.
 *  · **The original is never altered.** So the link lives on the NEW document
 *    as `convertedFromId`, and the reverse direction is a READ over the
 *    documents — not a write back onto a record that Rule #5 froze.
 *  · **A retried conversion never duplicates** (§M). The idempotency key is
 *    derived from (source, target type) rather than generated, so the same
 *    conversion asked for twice is the same key; and once a conversion exists
 *    the UI offers to OPEN it rather than quietly making a second.
 *
 * What comes across is the work — party, lines, dates — and never a stored
 * total: totals recompute from the lines at their new type's rules (Rule #3).
 */

import { type DocumentType, carriesMoney } from '../../domain/documents/types'
import type { LineItem } from '../../domain/documents/types'
import type { DocumentDraft } from './builder'
import { localDay } from '../../domain/dates/calendar'

export class ConvertError extends Error {}

/** The whole table. Absent pairs are absent on purpose. */
export const CONVERSIONS: Readonly<Record<DocumentType, readonly DocumentType[]>> = {
  quotation: ['invoice', 'waybill'],
  invoice: ['waybill'],
  waybill: ['invoice'],
  // Evidence of a payment. It converts to nothing, and nothing converts to it.
  receipt: [],
}

/** Statuses a document can be converted FROM, per type. */
const CONVERTIBLE_FROM: Readonly<Record<DocumentType, readonly string[]>> = {
  // An offer that was made — or accepted — can become the work.
  quotation: ['issued', 'sent', 'accepted'],
  invoice: ['issued', 'sent'],
  waybill: ['issued', 'dispatched', 'in_transit', 'delivered'],
  receipt: [],
}

export interface ConvertibleDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly currency: string
  readonly customerId?: string
  readonly lineItems: readonly LineItem[]
  readonly issueDate?: string
  readonly deliveryAddress?: string
}

/**
 * What this document can become, right now.
 *
 * A draft offers nothing: there is nothing agreed to carry forward, and the
 * answer is to edit the draft. A voided document offers nothing either.
 */
export function conversionsFor(document: ConvertibleDocument): DocumentType[] {
  if (!CONVERTIBLE_FROM[document.type].includes(document.status)) return []
  return [...CONVERSIONS[document.type]]
}

export const canConvert = (document: ConvertibleDocument, to: DocumentType): boolean =>
  conversionsFor(document).includes(to)

/**
 * The idempotency handle for one conversion.
 *
 * Derived, not generated: the same conversion asked for twice — a retried
 * upload, two devices, a double tap — yields the same key, so §M's "retried
 * conversions never duplicate" holds by arithmetic rather than by luck.
 */
export const conversionKeyFor = (sourceId: string, to: DocumentType): string =>
  `conv:${sourceId}:${to}`

export interface ConvertedDraft {
  readonly draft: DocumentDraft
  /** The link, on the NEW document. The original is never written to (§G). */
  readonly convertedFromId: string
  readonly idempotencyKey: string
  /**
   * True when the new document needs prices before it can be issued — a
   * delivery carries no money, so its lines arrive without any (§G).
   */
  readonly needsPrices: boolean
}

export interface ConvertOptions {
  readonly to: DocumentType
  /** Today, for the new document's own date. Never the original's. */
  readonly on: string
}

export function convertDocument(
  source: ConvertibleDocument,
  options: ConvertOptions,
): ConvertedDraft {
  const { to, on } = options

  if (source.type === to) {
    throw new ConvertError('A document is already what it is.')
  }
  if (!CONVERTIBLE_FROM[source.type].includes(source.status)) {
    throw new ConvertError(
      `A ${source.type} with status "${source.status}" has nothing agreed to carry forward.`,
    )
  }
  if (!CONVERSIONS[source.type].includes(to)) {
    throw new ConvertError(`A ${source.type} does not become a ${to} (v6 §G).`)
  }

  const targetCarriesMoney = carriesMoney(to)

  const lineItems: LineItem[] = source.lineItems.map((line) => ({
    id: line.id,
    description: line.description,
    quantityMilli: line.quantityMilli,
    taxable: line.taxable,
    /*
     * The unit crosses in BOTH directions, and it was crossing in neither.
     *
     * A delivery's content is what was handed over, and "10" without
     * "cartons" is not something anybody can sign for — so an invoice
     * converted to a delivery arrived with a blank unit column. Going the
     * other way it matters too: an invoice made from a delivery is about the
     * same cartons, and losing the word turns a priced line into a guess.
     */
    ...(line.unit === undefined ? {} : { unit: line.unit }),
    // Prices go where money goes and nowhere else. A delivery drops them; an
    // invoice made from a delivery has none to inherit and must be told.
    ...(targetCarriesMoney && line.unitPriceMinor !== undefined
      ? { unitPriceMinor: line.unitPriceMinor }
      : {}),
  }))

  const draft: DocumentDraft = {
    type: to,
    currency: source.currency,
    lineItems,
    // The new document is dated today. Carrying the original's date would
    // backdate work that is happening now.
    issueDate: localDay(on),
    ...(source.customerId === undefined ? {} : { customerId: source.customerId }),
    ...(to === 'waybill' && source.deliveryAddress !== undefined
      ? { deliveryAddress: source.deliveryAddress }
      : {}),
  }

  return {
    draft,
    convertedFromId: source.id,
    idempotencyKey: conversionKeyFor(source.id, to),
    needsPrices:
      targetCarriesMoney && lineItems.some((line) => line.unitPriceMinor === undefined),
  }
}

/**
 * §G's "links persist", read rather than written.
 *
 * The original is immutable, so the forward link is derived: the document that
 * came from this one is the one carrying its id.
 */
export function convertedInto<T extends { id: string; type: DocumentType; convertedFromId?: string }>(
  documents: readonly T[],
  sourceId: string,
  to: DocumentType,
): T | null {
  return documents.find((row) => row.convertedFromId === sourceId && row.type === to) ?? null
}

/** Every document made from this one, whatever its type. */
export function conversionsOf<T extends { convertedFromId?: string }>(
  documents: readonly T[],
  sourceId: string,
): T[] {
  return documents.filter((row) => row.convertedFromId === sourceId)
}

/** What this one was made from, for the link back. */
export function convertedFrom<T extends { id: string; convertedFromId?: string }>(
  documents: readonly T[],
  document: { convertedFromId?: string },
): T | null {
  if (document.convertedFromId === undefined) return null
  return documents.find((row) => row.id === document.convertedFromId) ?? null
}
