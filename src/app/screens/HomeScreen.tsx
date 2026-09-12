/**
 * Home, wired (§G).
 *
 * The screen component owns the layout; this owns the arithmetic's inputs. It
 * hands `Home` figures that came from `src/features/home/stats`, so the two
 * stat cards on screen are the ones the property tests bind.
 *
 * Sample records are excluded from every count and balance (§R) — the
 * prototype's seeded money never enters a real account.
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { documentPath, listPath } from '../paths'
import { Home } from '../../features/home/Home'
import { needsAttention, outstandingByCurrency, receivedThisMonth } from '../../features/home/stats'
import { SkeletonList } from '../../ui'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import { dueDates, statDocuments } from '../derive'

export function HomeScreen({ now = new Date() }: { now?: Date }) {
  const { strings } = useCompany()
  const { company, documents, payments, loading } = useAppData()
  const navigate = useNavigate()

  const today = now.toISOString().slice(0, 10)

  const stats = useMemo(() => statDocuments(documents), [documents])
  const due = useMemo(() => dueDates(documents), [documents])

  const counts = useMemo(() => {
    const tally: Record<DocumentType, number> = { invoice: 0, quotation: 0, receipt: 0, waybill: 0 }
    for (const document of documents) tally[document.type] += 1
    return tally
  }, [documents])

  if (loading) {
    return (
      <div className="px-4 py-6">
        <SkeletonList rows={4} label={strings.common.loading} />
      </div>
    )
  }

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
      onSearch={() => {
        // §G's one search field spans customers, numbers, amounts and item
        // names. The index is built in `src/features/search`; giving Home a
        // results body is its own screen and is not invented here.
      }}
    />
  )
}

export const HOME_TYPES = DOCUMENT_TYPES
