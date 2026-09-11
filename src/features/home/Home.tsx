/**
 * Home (§G) — "the only place all four types appear together".
 *
 * Exactly two stat cards, four type tiles, a search field, and the two or
 * three things that want doing. The connectivity pill is truthful: it is
 * driven by real connection plus pending work, never by a simulated toggle.
 *
 * The Voice and Scan controls §G places here are deliberately absent until
 * Phase 6 builds the capability ladder. A control that looks live and does
 * nothing is worse than one that is not there yet, and §N is explicit that an
 * unavailable capability is stated plainly rather than dressed up.
 */

import { useCompany } from '../../app/context'
import { label as typeLabel } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { ConnectivityPill, StatusBadge, TYPE_PALETTE } from '../../ui'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import type { CurrencyCode, Money } from '../../domain/money/money'
import { formatMoney } from '../customers/formatMoney'
import type { AttentionItem } from './stats'

export interface HomeProps {
  readonly businessName: string
  readonly userName: string
  readonly now: Date
  readonly online: boolean
  readonly pendingCount: number
  readonly failedCount: number
  readonly outstanding: ReadonlyMap<CurrencyCode, Money>
  readonly received: ReadonlyMap<CurrencyCode, Money>
  readonly counts: Readonly<Record<DocumentType, number>>
  readonly attention: readonly AttentionItem[]
  readonly onOpenType: (type: DocumentType) => void
  readonly onOpenDocument: (id: string) => void
  readonly onSearch: (query: string) => void
}

function greeting(now: Date, strings: ReturnType<typeof useCompany>['strings']): string {
  const hour = now.getHours()
  if (hour < 12) return strings.home.greetingMorning
  if (hour < 17) return strings.home.greetingAfternoon
  return strings.home.greetingEvening
}

function StatCard({
  title,
  amounts,
  emptyLabel,
}: {
  title: string
  amounts: ReadonlyMap<CurrencyCode, Money>
  emptyLabel: string
}) {
  const entries = [...amounts.entries()].filter(([, amount]) => amount.minor !== 0)

  return (
    <section
      className="flex-1 rounded-2xl bg-white/70 p-4 backdrop-blur"
      aria-label={title}
    >
      <p className="text-xs font-medium opacity-70">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-1 text-lg font-bold opacity-50">{emptyLabel}</p>
      ) : (
        // One line per currency — never a combined figure (§G, §V).
        entries.map(([currency, amount]) => (
          <p key={currency} className="mt-1 text-lg font-bold tabular-nums">
            {formatMoney(amount)}
          </p>
        ))
      )}
    </section>
  )
}

export function Home({
  businessName,
  userName,
  now,
  online,
  pendingCount,
  failedCount,
  outstanding,
  received,
  counts,
  attention,
  onOpenType,
  onOpenDocument,
  onSearch,
}: HomeProps) {
  const { profile, strings } = useCompany()

  return (
    <div className="pb-24">
      <header className="rounded-b-2xl bg-gradient-to-br from-brand-light via-brand to-brand-deep px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/90 text-[9px] font-semibold text-navy"
            aria-label={strings.home.addLogo}
          >
            +
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{businessName}</p>
          <ConnectivityPill
            online={online}
            pendingCount={pendingCount}
            failedCount={failedCount}
            labels={{
              saved_local: strings.sync.savedLocal,
              waiting: strings.sync.waiting,
              uploaded: strings.sync.uploaded,
              needs_review: strings.sync.needsReview,
            }}
          />
        </div>

        <p className="mt-4 text-xl font-bold">
          {greeting(now, strings)}, {userName}
        </p>
      </header>

      <div className="-mt-4 flex gap-3 px-4">
        <StatCard
          title={strings.home.outstanding}
          amounts={outstanding}
          emptyLabel={strings.home.nothingOutstanding}
        />
        <StatCard
          title={strings.home.receivedThisMonth}
          amounts={received}
          emptyLabel={strings.home.nothingReceived}
        />
      </div>

      <div className="px-4 pt-4">
        <label className="block">
          <span className="sr-only">{strings.home.searchEverything}</span>
          <input
            type="search"
            onChange={(event) => onSearch(event.target.value)}
            placeholder={strings.home.searchEverything}
            aria-label={strings.home.searchEverything}
            className="min-h-tap w-full rounded-lg bg-white/80 px-4 text-sm shadow-inner"
          />
        </label>
      </div>

      <ul className="grid grid-cols-2 gap-3 px-4 pt-4">
        {DOCUMENT_TYPES.map((type) => {
          const palette = TYPE_PALETTE[type]
          return (
            <li key={type}>
              <button
                type="button"
                onClick={() => onOpenType(type)}
                className="flex w-full flex-col items-start gap-1 rounded-2xl p-4 text-left text-white"
                style={{ backgroundColor: palette.accent, boxShadow: `0 8px 20px -8px ${palette.accent}` }}
              >
                <span className="break-words text-sm font-bold leading-tight">
                  {typeLabel(profile, type)}
                </span>
                <span className="text-xs font-semibold opacity-80 tabular-nums">
                  {counts[type]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {attention.length > 0 && (
        <section className="px-4 pt-6" aria-label={strings.home.needsAttention}>
          <h2 className="text-sm font-bold">{strings.home.needsAttention}</h2>
          <ul className="mt-2 space-y-2">
            {attention.map((item) => (
              <li key={item.documentId}>
                <button
                  type="button"
                  onClick={() => onOpenDocument(item.documentId)}
                  className="flex min-h-tap w-full items-center gap-3 rounded-2xl bg-white/85 p-3 text-left"
                >
                  <span className="flex-1">
                    <StatusBadge
                      status={item.kind === 'overdue' ? 'overdue' : 'in_transit'}
                      label={
                        item.kind === 'overdue'
                          ? format(strings.home.overdueBy, {
                              amount: item.amount === undefined ? '' : formatMoney(item.amount),
                            })
                          : strings.home.inTransit
                      }
                    />
                  </span>
                  <span className="shrink-0 rounded-full bg-page px-3 py-1 text-xs font-semibold">
                    {item.kind === 'overdue' ? strings.home.chase : strings.home.sign}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
