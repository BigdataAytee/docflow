/**
 * "What sells best — top items by value" (§G).
 *
 * By VALUE, not by count: ten ₦500 sachets are not the business's best line
 * when one ₦400,000 generator went out the same month, and §G asks for the
 * question the owner actually has.
 *
 * Only issued, non-void invoices count. A quotation is a price someone was
 * offered, not something that sold; a delivery document carries no money at
 * all; and a receipt is a view of a payment, so counting it would sell every
 * settled line twice.
 */

import { type CurrencyCode, type Money, add, zero } from '../../domain/money/money'
import { lineTotal } from '../../domain/money/totals'
import type { DocumentType, LineItem } from '../../domain/documents/types'

export interface SoldDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly currency: CurrencyCode
  readonly issueDate?: string
  readonly lineItems: readonly LineItem[]
}

export interface TopItem {
  /** The spelling the owner typed most often, not a normalised key. */
  readonly name: string
  readonly currency: CurrencyCode
  readonly value: Money
  readonly quantityMilli: number
  readonly documentCount: number
}

/** "Bag of cement", "bag of  Cement " and "BAG OF CEMENT" are one product. */
const groupingKey = (description: string): string =>
  description.trim().toLowerCase().replace(/\s+/g, ' ')

const sold = (document: SoldDocument): boolean =>
  document.type === 'invoice' && document.status !== 'draft' && document.status !== 'void'

interface Accumulator {
  readonly currency: CurrencyCode
  value: Money
  quantityMilli: number
  documentCount: number
  readonly spellings: Map<string, number>
}

/**
 * Top items by value, per currency, highest first.
 *
 * `period` is optional: the analytics page asks for a month, the customer
 * screen may ask for everything. An undefined period means all time rather
 * than a silently-assumed window.
 */
export function topItems(
  documents: readonly SoldDocument[],
  options: {
    readonly currency?: CurrencyCode
    readonly from?: string
    readonly to?: string
    readonly limit?: number
  } = {},
): TopItem[] {
  // Keyed by currency first, so two currencies never share a product row (§G).
  const groups = new Map<CurrencyCode, Map<string, Accumulator>>()

  for (const document of documents) {
    if (!sold(document)) continue
    if (options.currency !== undefined && document.currency !== options.currency) continue

    const day = document.issueDate?.slice(0, 10)
    if (options.from !== undefined && (day === undefined || day < options.from)) continue
    if (options.to !== undefined && (day === undefined || day >= options.to)) continue

    const perCurrency = groups.get(document.currency) ?? new Map<string, Accumulator>()
    groups.set(document.currency, perCurrency)

    for (const line of document.lineItems) {
      // A line with no price is a delivery line; it has no value to rank by.
      if (line.unitPriceMinor === undefined) continue
      const name = line.description.trim()
      if (name === '') continue

      const key = groupingKey(name)
      const group = perCurrency.get(key) ?? {
        currency: document.currency,
        value: zero(document.currency),
        quantityMilli: 0,
        documentCount: 0,
        spellings: new Map<string, number>(),
      }
      group.value = add(group.value, lineTotal(document.currency, line))
      group.quantityMilli += line.quantityMilli
      group.documentCount += 1
      group.spellings.set(name, (group.spellings.get(name) ?? 0) + 1)
      perCurrency.set(key, group)
    }
  }

  const ranked: TopItem[] = []
  for (const perCurrency of groups.values()) {
    for (const group of perCurrency.values()) {
      ranked.push({
        name: mostCommon(group.spellings),
        currency: group.currency,
        value: group.value,
        quantityMilli: group.quantityMilli,
        documentCount: group.documentCount,
      })
    }
  }

  // Value first; ties broken by name so the order is stable between renders.
  ranked.sort((a, b) => b.value.minor - a.value.minor || a.name.localeCompare(b.name))
  return options.limit === undefined ? ranked : ranked.slice(0, options.limit)
}

function mostCommon(spellings: ReadonlyMap<string, number>): string {
  let best = ''
  let bestCount = -1
  for (const [spelling, count] of spellings) {
    if (count > bestCount || (count === bestCount && spelling.localeCompare(best) < 0)) {
      best = spelling
      bestCount = count
    }
  }
  return best
}
