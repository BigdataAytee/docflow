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

import type { ReactNode } from 'react'

import { useCompany } from '../../app/context'
import { label as typeLabel, pluralLabel } from '../../domain/locale/profile'
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
  /**
   * §G: "typing replaces the body with results". When this is present the
   * tiles and the attention list step aside for it — the header, the stat
   * cards and the field itself stay, so the way back is always on screen.
   */
  readonly searchQuery?: string
  readonly results?: ReactNode
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
      // `min-w-0` because a flex item defaults to `min-width: auto` and will
      // not shrink below its content — so at 200% text these two cards pushed
      // the page 208px wider than the phone. Found by the large-text sweep.
      className="min-w-0 flex-1 rounded-2xl bg-surface/70 p-4 backdrop-blur"
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
  searchQuery,
  results,
}: HomeProps) {
  const { profile, strings } = useCompany()

  return (
    <div className="pb-24">
      <header className="rounded-b-2xl bg-gradient-to-br from-brand-light via-brand to-brand-deep px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-3">
          {/*
            `aria-hidden`, not `aria-label`. This is a placeholder square, not
            a control — nothing happens when it is activated, and a name on a
            role-less span is dropped by some engines and announced by others.
            Advertising an action that is not there is the §N failure mode:
            say plainly what is available, and stay silent about what is not.
            The logo is set in Settings → Company, which is reachable.
          */}
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface/90 text-[9px] font-semibold text-ink"
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

        {/*
          The page's h1. It was a paragraph, so Home — the app's first screen —
          opened with a level-2 heading and nothing above it, and a reader
          jumping by heading could not tell where the page began. The biggest
          line on the screen is now also the biggest line in the outline.
        */}
        <h1 className="mt-4 text-xl font-bold">
          {greeting(now, strings)}, {userName}
        </h1>
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
            value={searchQuery ?? ''}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={strings.home.searchEverything}
            aria-label={strings.home.searchEverything}
            className="min-h-tap w-full rounded-lg bg-surface/80 px-4 text-sm shadow-inner"
          />
        </label>
      </div>

      {/* §G: typing replaces the body. The header, the stat cards and the
          field above stay put, so there is always a way back. */}
      {results ?? (
        <>
          <ul className="grid grid-cols-2 gap-3 px-4 pt-4">
            {DOCUMENT_TYPES.map((type) => {
              const palette = TYPE_PALETTE[type]
              return (
                // `min-w-0` for the same reason as the stat cards above: a
                // GRID item also defaults to `min-width: auto`, so the widest
                // label held the column open and `break-words` never got the
                // chance to wrap it.
                <li key={type} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenType(type)}
                    // Read aloud, the two spans below run together as
                    // "Invoice 3", which sounds like a reference number. The
                    // count line already says it properly in every language.
                    aria-label={format(strings.lists.countLine, {
                      count: counts[type],
                      label: pluralLabel(profile, type),
                    })}
                    className="flex w-full min-w-0 flex-col items-start gap-1 rounded-2xl p-4 text-start text-white"
                    style={{ backgroundColor: palette.accent, boxShadow: `0 8px 20px -8px ${palette.accent}` }}
                  >
                    {/*
                      `overflow-wrap: anywhere`, not `break-words`. The two
                      differ in exactly the case that bit here: `break-word`
                      breaks a long word to avoid overflowing, but does not
                      reduce the element's min-content width — so "Quotation"
                      at 200% text still held the tile 157px wide in a 151px
                      column. `anywhere` does shrink it.
                    */}
                    <span className="text-sm font-bold leading-tight [overflow-wrap:anywhere]">
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
                      className="flex min-h-tap w-full items-center gap-3 rounded-2xl bg-surface/85 p-3 text-start"
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
        </>
      )}
    </div>
  )
}
