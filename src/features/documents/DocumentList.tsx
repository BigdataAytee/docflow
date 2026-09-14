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
import { EmptyState, Icon, SkeletonList, StatusBadge, TYPE_PALETTE } from '../../ui'
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
        className="sheen-strong relative overflow-hidden rounded-2xl p-5 text-white"
        style={{
          backgroundImage: `linear-gradient(150deg, ${palette.accent}, ${palette.deep})`,
          // The hero carries its own accent shadow, like the Home tiles (§F).
          boxShadow: `0 18px 34px -18px ${palette.accent}, 0 2px 6px -2px rgb(20 28 74 / 0.24)`,
        }}
      >
        {/*
          §G's "soft corner circles". Decorative and inert — and drawn with
          `overflow-hidden` on the parent rather than clipped by hand, so a
          circle can hang off the edge without widening the page. That last
          part is not cosmetic: an absolutely-positioned decoration is the
          classic cause of a sideways scroll on a 360px phone.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -end-10 -top-12 h-36 w-36 rounded-full bg-on-accent/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -end-4 h-28 w-28 rounded-full bg-on-accent/5"
        />

        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] opacity-75">
          {strings.lists.eyebrow}
        </p>
        {/* Wraps rather than clipping — §F tests the longest shipped label. */}
        <h1 className="mt-1 flex items-center gap-2 break-words text-2xl font-black leading-tight">
          <Icon name={palette.icon} size={1.15} className="shrink-0 opacity-90" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        </h1>
        <p className="mt-0.5 text-sm opacity-85">
          {format(strings.lists.countLine, { count: rows?.length ?? 0, label: plural })}
        </p>
        <button
          type="button"
          onClick={onNew}
          // Inset, not raised: §G calls it a translucent button INSIDE the
          // hero, and a second raised surface on a card that is already
          // lifted reads as two cards fighting.
          className="tap-scale mt-3 inline-flex min-h-tap items-center rounded-full bg-on-accent/20 px-4 text-sm font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.28)] backdrop-blur"
        >
          {/*
            No plus GLYPH here: the catalogue's own string is "+ New {label}",
            so an icon beside it renders "+ + New Invoice". The FAB below is
            the one that needs a symbol, because it has no words at all.
          */}
          <span className="[overflow-wrap:anywhere]">
            {format(strings.lists.newDocument, { label })}
          </span>
        </button>
      </div>

      <label className="relative mt-4 block">
        <span className="sr-only">{format(strings.lists.searchIn, { label: plural })}</span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center opacity-45"
        >
          <Icon name="search" size={1.05} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={format(strings.lists.searchIn, { label: plural })}
          aria-label={format(strings.lists.searchIn, { label: plural })}
          className="recessed min-h-tap w-full rounded-full ps-10 pe-4 text-sm"
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
          <ul className="glass-solid overflow-hidden rounded-2xl">
            {visible.map((row) => (
              <li key={row.id} className="border-b border-ink/10 last:border-0">
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
        className="raised tap-scale fixed bottom-28 end-5 z-10 grid h-14 w-14 place-items-center rounded-full text-white"
        style={{
          backgroundImage: `linear-gradient(150deg, ${palette.accent}, ${palette.deep})`,
          // Its own colour at depth, so the FAB reads as belonging to this
          // type's page rather than as a floating grey circle (§F).
          boxShadow: `0 14px 24px -10px ${palette.accent}, 0 2px 6px -2px rgb(20 28 74 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.28)`,
        }}
      >
        <Icon name="plus" size={1.5} />
      </button>
    </section>
  )
}
