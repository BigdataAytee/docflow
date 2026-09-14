/**
 * Home's search results body (§G).
 *
 * "Typing replaces the body with results; no match gives a plain empty state
 * with suggestions."
 *
 * The matching is not here — `buildIndex` and `search` already do it, and
 * §D.3's hard part is theirs: an issued document is findable by the word it
 * was issued under AND by the word the company uses now. This file only
 * arranges what came back.
 *
 * Three things it is careful about:
 *
 *  · **Every result is a way in.** A result that cannot be opened is a tease,
 *    so items route to the saved list they live in rather than nowhere.
 *  · **The suggestions are real searches**, not decoration: each chip is a
 *    type's own name in this region, which §D.3 guarantees finds its
 *    documents. Nothing suggests a query that would come back empty.
 *  · **The kinds stay apart.** A customer and a document that share a name are
 *    two different answers, and merging them would make the list a guess.
 */

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import { label as typeLabel } from '../../domain/locale/profile'
import { EmptyState } from '../../ui'
import type { IndexEntry, IndexedKind } from './index'

export interface SearchResultsProps {
  readonly query: string
  readonly results: readonly IndexEntry[]
  readonly onOpenDocument: (id: string) => void
  readonly onOpenCustomer: (id: string) => void
  readonly onOpenItem: () => void
  /** Tapping a suggestion runs it, so the field and the body stay in step. */
  readonly onSuggest: (query: string) => void
  readonly onClear: () => void
  /** The second line on a document row — its customer, its status, a date. */
  readonly detailOf?: (entry: IndexEntry) => string | undefined
}

const ORDER: readonly IndexedKind[] = ['document', 'customer', 'item']

export function SearchResults({
  query,
  results,
  onOpenDocument,
  onOpenCustomer,
  onOpenItem,
  onSuggest,
  onClear,
  detailOf,
}: SearchResultsProps) {
  const { profile, strings } = useCompany()

  const heading: Readonly<Record<IndexedKind, string>> = {
    document: strings.search.documents,
    customer: strings.search.customers,
    item: strings.search.items,
  }

  const open = (entry: IndexEntry) => {
    if (entry.kind === 'document') return onOpenDocument(entry.id)
    if (entry.kind === 'customer') return onOpenCustomer(entry.id)
    return onOpenItem()
  }

  if (results.length === 0) {
    return (
      <div className="px-4 pt-4">
        <EmptyState
          title={format(strings.search.noMatch, { query })}
          body={strings.search.noMatchBody}
          action={
            <div className="space-y-2">
              <p className="text-xs font-medium opacity-70">{strings.search.tryOneOfThese}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {DOCUMENT_TYPES.map((type: DocumentType) => {
                  // The region's own word for this type — §D.3 guarantees it
                  // finds that type's documents, so no chip can come back empty.
                  const word = typeLabel(profile, type)
                  return (
                    <button
                      key={type}
                      type="button"
                      className="min-h-tap rounded-full border border-edge/10 bg-surface px-3 text-xs font-medium"
                      onClick={() => onSuggest(word)}
                    >
                      {word}
                    </button>
                  )
                })}
              </div>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium opacity-70">
          {format(strings.search.matches, { count: results.length })}
        </p>
        <button type="button" className="text-xs font-medium text-brand" onClick={onClear}>
          {strings.search.clear}
        </button>
      </div>

      {ORDER.map((kind) => {
        const group = results.filter((entry) => entry.kind === kind)
        if (group.length === 0) return null

        return (
          <section key={kind} className="mt-3" aria-label={heading[kind]}>
            <h2 className="text-sm font-bold">{heading[kind]}</h2>
            <ul className="mt-2 space-y-2">
              {group.map((entry) => {
                const detail = detailOf?.(entry)
                return (
                  <li key={`${entry.kind}-${entry.id}`}>
                    <button
                      type="button"
                      onClick={() => open(entry)}
                      className="glass-solid flex min-h-tap w-full flex-col items-start justify-center rounded-2xl px-4 py-2.5 text-start"
                    >
                      <span className="w-full break-words text-sm font-semibold">{entry.label}</span>
                      {detail !== undefined && detail !== '' && (
                        <span className="w-full break-words text-xs opacity-70">{detail}</span>
                      )}
                      {entry.kind === 'item' && (
                        <span className="text-[11px] opacity-60">{strings.search.openInSettings}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
