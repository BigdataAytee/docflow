/**
 * Home, wired (§G).
 *
 * The screen component owns the layout; this owns the arithmetic's inputs. It
 * hands `Home` figures that came from `src/features/home/stats`, so the two
 * stat cards on screen are the ones the property tests bind.
 *
 * The search field is §G's "one field across customers, numbers, amounts and
 * item names, matching both current and frozen labels". The index is built
 * from this device's own records and rebuilt only when those records or the
 * region change — §L10 calls it built-once, searched-many, and a keystroke
 * must not re-resolve a label.
 */

import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { customerPath, documentPath, listPath, settingsPath } from '../paths'
import { Home } from '../../features/home/Home'
import { needsAttention, outstandingByCurrency, receivedThisMonth } from '../../features/home/stats'
import { SearchResults } from '../../features/search/SearchResults'
import { buildIndex, search, type IndexEntry } from '../../features/search'
import { formatMoney } from '../../features/customers/formatMoney'
import { SkeletonList } from '../../ui'
import { numberingPrefix } from '../../domain/locale/profile'
import type { DocumentType } from '../../domain/documents/types'
import {
  customerNames,
  displayStatus,
  dueDates,
  statDocuments,
  totalOf,
} from '../derive'

/**
 * `customerName` is optional on the index entry and `exactOptionalPropertyTypes`
 * means absent and undefined are different things — so the key is spread in
 * only when there is a name.
 */
function customerNameOf(
  names: ReadonlyMap<string, string>,
  customerId: string | undefined,
): { customerName?: string } {
  if (customerId === undefined) return {}
  const name = names.get(customerId)
  return name === undefined ? {} : { customerName: name }
}

export function HomeScreen({ now = new Date() }: { now?: Date }) {
  const { profile, strings } = useCompany()
  const { company, customers, documents, payments, items, loading } = useAppData()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  // Typing stays responsive on a large account: the field updates now, the
  // results catch up (§L10 — performance is invisible).
  const deferredQuery = useDeferredValue(query)

  const today = now.toISOString().slice(0, 10)

  const stats = useMemo(() => statDocuments(documents), [documents])
  const due = useMemo(() => dueDates(documents), [documents])

  const counts = useMemo(() => {
    const tally: Record<DocumentType, number> = { invoice: 0, quotation: 0, receipt: 0, waybill: 0 }
    for (const document of documents) tally[document.type] += 1
    return tally
  }, [documents])

  const names = useMemo(() => customerNames(customers), [customers])

  const index = useMemo(
    () =>
      buildIndex(profile, {
        documents: documents.map((document) => ({
          id: document.id,
          type: document.type,
          // A draft is findable by its provisional number, which is what the
          // owner sees on the list page (§M).
          reference:
            document.issuedReference ??
            `${company?.numberingPrefixes?.[document.type] ?? numberingPrefix(profile, document.type)}-…`,
          frozenLabels: document.frozenLabels,
          ...customerNameOf(names, document.customerId),
          // A delivery document carries no money, so it is not findable by one.
          ...(document.type === 'waybill' ? {} : { total: totalOf(document) }),
          lineDescriptions: document.lineItems.map((line) => line.description),
        })),
        customers: customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          ...(customer.phone === undefined ? {} : { phone: customer.phone }),
          ...(customer.address === undefined ? {} : { address: customer.address }),
        })),
        items: items.map((item) => ({ id: item.id, name: item.name })),
      }),
    [profile, documents, customers, items, company, names],
  )

  const results = useMemo(() => search(index, deferredQuery), [index, deferredQuery])

  /** The second line on a result row: who it is for, and where it stands. */
  const detailOf = (entry: IndexEntry): string | undefined => {
    if (entry.kind !== 'document') return undefined
    const document = documents.find((row) => row.id === entry.id)
    if (document === undefined) return undefined

    const status = displayStatus(document, payments, today)
    const name = document.customerId === undefined ? undefined : names.get(document.customerId)
    const amount = document.type === 'waybill' ? undefined : formatMoney(totalOf(document))

    return [name, strings.statuses[status] ?? status, amount].filter((part) => part !== undefined).join(' · ')
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <SkeletonList rows={4} label={strings.common.loading} />
      </div>
    )
  }

  const searching = query.trim() !== ''

  return (
    <Home
      businessName={company?.name ?? ''}
      userName=""
      now={now}
      online={false}
      pendingCount={0}
      failedCount={0}
      outstanding={outstandingByCurrency(stats, payments)}
      received={receivedThisMonth(payments, now.toISOString())}
      counts={counts}
      attention={needsAttention(stats, payments, due, today)}
      onOpenType={(type) => navigate(listPath(type))}
      onOpenDocument={(id) => navigate(documentPath(id))}
      onSearch={setQuery}
      searchQuery={query}
      {...(searching
        ? {
            results: (
              <SearchResults
                query={query}
                results={results}
                detailOf={detailOf}
                onOpenDocument={(id) => navigate(documentPath(id))}
                onOpenCustomer={(id) => navigate(customerPath(id))}
                onOpenItem={() => navigate(settingsPath('items'))}
                onSuggest={setQuery}
                onClear={() => setQuery('')}
              />
            ),
          }
        : {})}
    />
  )
}
