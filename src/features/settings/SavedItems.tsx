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
import { EmptyState, SkeletonList } from '../../ui'
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
      <h1 className="text-lg font-bold">{strings.settings.savedItems}</h1>

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
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.name}</span>
                <span className="block text-xs opacity-70">
                  {format(strings.settings.usedTimes, { count: item.timesUsed })}
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
