/**
 * Settings → Saved items (§G, §L2).
 *
 * "The saved item catalogue builds itself from what gets typed; autocomplete in
 * Items; full list in Settings; prices update next time."
 *
 * Nothing is added here. The list is a view of what the builder already
 * remembered, which is why there is no "add item" control on this screen —
 * adding one would be a second way to build the catalogue, and §L2 describes
 * exactly one.
 */

import { useEffect, useState } from 'react'

import { useCompany } from '../../app/context'
import { EmptyState, Icon, SkeletonList } from '../../ui'
import { format } from '../../domain/locale/data/strings'
import type { SavedItem } from '../../data/repositories'
import { formatMoney } from '../customers/formatMoney'

export function SavedItems({ onRemove }: { onRemove?: (id: string) => void }) {
  const { companyId, repositories, strings } = useCompany()
  const [items, setItems] = useState<SavedItem[] | null>(null)

  useEffect(() => {
    let live = true
    void repositories.items.list(companyId).then((rows) => {
      if (live) setItems(rows)
    })
    return () => {
      live = false
    }
  }, [companyId, repositories])

  return (
    <section className="space-y-4 px-4 py-4">
      <header>
        <h1 className="text-lg font-bold">{strings.settings.savedItems}</h1>
        {/* The reference's line, and it is the whole explanation of §L2. */}
        <p className="mt-0.5 text-xs leading-relaxed opacity-70">
          {strings.settings.savedItemsHint}
        </p>
      </header>

      {items === null && <SkeletonList rows={3} label={strings.common.loading} />}

      {items !== null && items.length === 0 && (
        <EmptyState
          title={strings.settings.noSavedItems}
          body={strings.settings.noSavedItemsBody}
        />
      )}

      {items !== null && items.length > 0 && (
        <ul className="glass-solid divide-y divide-ink/10 overflow-hidden rounded-2xl">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink"
              >
                <Icon name="package" size={0.85} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.name}</span>
                {/*
                  THE UNIT, where there is one. §E gives the catalogue a
                  `unit` column, the items step has always had a field for it,
                  and nothing carried it from one to the other — so every
                  saved item had a price and no unit and this row could only
                  ever say how often it had been used. "per carton" is what a
                  person is actually checking when they open this list.
                */}
                <span className="block truncate text-xs opacity-70">
                  {item.unit === undefined
                    ? format(strings.settings.usedTimes, { count: item.timesUsed })
                    : format(strings.settings.perUnit, { unit: item.unit })}
                </span>
              </span>
              {item.lastPrice !== undefined && (
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(item.lastPrice)}
                </span>
              )}
              {onRemove !== undefined && (
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`${strings.common.remove} ${item.name}`}
                  className="min-h-tap min-w-tap shrink-0 rounded-full text-ink/50"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
