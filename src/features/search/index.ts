/**
 * The local search index (§G Home search, §D.3, §L10).
 *
 * §G: "one field across customers, numbers, amounts and item names, matching
 * both current and frozen labels."
 * §D.3: "Searching 'waybill' or 'delivery note' finds the same documents; the
 * index includes the internal type, the current label, and the frozen label of
 * issued documents."
 *
 * That last clause is the interesting one. A company that moves from Lagos to
 * Manchester must still find the documents it issued as waybills by typing
 * "waybill" — the word it used at the time — AND by typing "delivery note",
 * the word it uses now. So an issued document carries both into the index.
 *
 * §L10 calls this performance work: built once, searched many times, rather
 * than re-resolving labels on every keystroke.
 */

import type { DocumentType, FrozenLabels } from '../../domain/documents/types'
import type { LocaleProfile } from '../../domain/locale/profile'
import { searchTerms } from '../../domain/locale/profile'
import type { Money } from '../../domain/money/money'

export type IndexedKind = 'document' | 'customer' | 'item'

export interface IndexableDocument {
  readonly id: string
  readonly type: DocumentType
  readonly reference: string
  readonly customerName?: string
  readonly frozenLabels: FrozenLabels | null
  readonly total?: Money
  readonly lineDescriptions?: readonly string[]
}

export interface IndexableCustomer {
  readonly id: string
  readonly name: string
  readonly phone?: string
  readonly address?: string
}

export interface IndexableItem {
  readonly id: string
  readonly name: string
}

export interface IndexEntry {
  readonly id: string
  readonly kind: IndexedKind
  readonly label: string
  /** Everything this entry can be found by, lower-cased. */
  readonly terms: readonly string[]
}

const norm = (value: string): string => value.trim().toLocaleLowerCase()

/** Digits only, so "₦95,000.00", "95000" and "95,000" all match a figure. */
const digits = (value: string): string => value.replace(/\D/g, '')

export function buildIndex(
  profile: LocaleProfile,
  input: {
    documents?: readonly IndexableDocument[]
    customers?: readonly IndexableCustomer[]
    items?: readonly IndexableItem[]
  },
): IndexEntry[] {
  const entries: IndexEntry[] = []

  for (const document of input.documents ?? []) {
    const terms = new Set<string>([
      norm(document.reference),
      digits(document.reference),
      // The internal type, the current label, the synonyms, and — for an
      // issued document — the frozen printed title (§D.3).
      ...searchTerms(profile, document.type, document.frozenLabels),
    ])
    if (document.customerName !== undefined) terms.add(norm(document.customerName))
    if (document.total !== undefined) terms.add(String(document.total.minor))
    if (document.total !== undefined) terms.add(String(Math.round(document.total.minor / 100)))
    for (const line of document.lineDescriptions ?? []) terms.add(norm(line))

    entries.push({
      id: document.id,
      kind: 'document',
      label: document.reference,
      terms: [...terms].filter((term) => term !== ''),
    })
  }

  for (const customer of input.customers ?? []) {
    const terms = new Set<string>([norm(customer.name)])
    if (customer.phone !== undefined) {
      terms.add(norm(customer.phone))
      terms.add(digits(customer.phone))
    }
    if (customer.address !== undefined) terms.add(norm(customer.address))
    entries.push({
      id: customer.id,
      kind: 'customer',
      label: customer.name,
      terms: [...terms].filter((term) => term !== ''),
    })
  }

  for (const item of input.items ?? []) {
    entries.push({ id: item.id, kind: 'item', label: item.name, terms: [norm(item.name)] })
  }

  return entries
}

/** Substring match across every term. Empty query returns nothing, not all. */
export function search(entries: readonly IndexEntry[], query: string, limit = 20): IndexEntry[] {
  const q = norm(query)
  if (q === '') return []

  const qDigits = digits(query)
  return entries
    .filter((entry) =>
      entry.terms.some(
        (term) => term.includes(q) || (qDigits !== '' && term.includes(qDigits)),
      ),
    )
    .slice(0, limit)
}
