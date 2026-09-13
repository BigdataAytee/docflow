/**
 * One page per type (§G) — "never combined tabs".
 *
 * "Hero card in the type colour (eyebrow DOCUMENTS, localised type name +
 * icon, count line — '4 invoices' / '3 delivery notes', inset translucent
 * '+ New {label}' button). Type-named live search below. One white list
 * container with hairline rows: reference + status badge left, amount right
 * (delivery documents show no amount), customer on the second line."
 */

import { useMemo, useState } from 'react'

import { useCompany } from '../../app/context'
import { label as typeLabel, pluralLabel } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { EmptyState, SkeletonList, StatusBadge, TYPE_PALETTE } from '../../ui'
import { carriesMoney, type DocumentType } from '../../domain/documents/types'
import type { Money } from '../../domain/money/money'
import { formatMoney } from '../customers/formatMoney'

export interface ListRow {
  readonly id: string
  readonly reference: string
  readonly status: string
  readonly statusLabel: string
  readonly customerName?: string
  /** Absent on a delivery document — the column does not exist there (§G). */
  readonly amount?: Money
  /**
   * "Replaced by Rev 2", when a newer offer exists (§G). Without it a list of
   * two sent quotations cannot say which one is live — which is the exact
   * question making a Rev 2 creates.
   */
  readonly note?: string
}

export interface DocumentListProps {
  readonly type: DocumentType
  readonly rows: readonly ListRow[] | null
  readonly onOpen: (id: string) => void
  readonly onNew: () => void
}

export function DocumentList({ type, rows, onOpen, onNew }: DocumentListProps) {
  const { profile, strings } = useCompany()
  const [query, setQuery] = useState('')

  const palette = TYPE_PALETTE[type]
  const label = typeLabel(profile, type)
  const plural = pluralLabel(profile, type)
  const showsMoney = carriesMoney(type)

  const visible = useMemo(() => {
    if (rows === null) return null
    const q = query.trim().toLocaleLowerCase()
    if (q === '') return rows
    return rows.filter((row) =>
      [row.reference, row.customerName]
        .filter((v): v is string => typeof v === 'string')
        .some((v) => v.toLocaleLowerCase().includes(q)),
    )
  }, [rows, query])

  return (
    <section className="px-4 pb-24 pt-4">
      <div
        className="relative overflow-hidden rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(150deg, ${palette.accent}, ${palette.deep})` }}
      >
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] opacity-75">
          {strings.lists.eyebrow}
        </p>
        {/* Wraps rather than clipping — §F tests the longest shipped label. */}
        <h1 className="mt-1 break-words text-2xl font-black leading-tight">{label}</h1>
        <p className="mt-0.5 text-sm opacity-85">
          {format(strings.lists.countLine, { count: rows?.length ?? 0, label: plural })}
        </p>
        <button
          type="button"
          onClick={onNew}
          className="mt-3 min-h-tap rounded-full bg-white/20 px-4 text-sm font-semibold backdrop-blur"
        >
          {format(strings.lists.newDocument, { label })}
        </button>
      </div>

      <label className="mt-4 block">
        <span className="sr-only">{format(strings.lists.searchIn, { label: plural })}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={format(strings.lists.searchIn, { label: plural })}
          aria-label={format(strings.lists.searchIn, { label: plural })}
          className="min-h-tap w-full rounded-lg bg-white/80 px-4 text-sm shadow-inner"
        />
      </label>

      <div className="mt-4">
        {visible === null && <SkeletonList rows={3} label={strings.common.loading} />}

        {visible !== null && visible.length === 0 && (
          <EmptyState
            title={rows?.length === 0 ? strings.lists.none : strings.lists.noMatch}
            {...(rows?.length === 0 ? { body: strings.lists.noneBody } : {})}
          />
        )}

        {visible !== null && visible.length > 0 && (
          <ul className="overflow-hidden rounded-2xl bg-white/85">
            {visible.map((row) => (
              <li key={row.id} className="border-b border-navy/8 last:border-0">
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  className="flex min-h-tap w-full items-center gap-3 p-3 text-start"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold tabular-nums">
                        {row.reference}
                      </span>
                      <StatusBadge status={row.status} label={row.statusLabel} />
                    </span>
                    {row.customerName !== undefined && (
                      <span className="mt-0.5 block truncate text-xs opacity-70">
                        {row.customerName}
                      </span>
                    )}
                    {row.note !== undefined && (
                      <span className="mt-0.5 block truncate text-xs font-medium text-status-warn">
                        {row.note}
                      </span>
                    )}
                  </span>
                  {/* No amount on a delivery document, in any locale (§G). */}
                  {showsMoney && row.amount !== undefined && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMoney(row.amount)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The create button is a FAB on the list page, never in the nav (§F). */}
      <button
        type="button"
        onClick={onNew}
        aria-label={format(strings.lists.newDocument, { label })}
        className="fixed bottom-24 end-5 grid h-14 w-14 place-items-center rounded-full text-2xl font-light text-white shadow-lg"
        style={{ backgroundColor: palette.accent }}
      >
        +
      </button>
    </section>
  )
}
