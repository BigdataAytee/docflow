/**
 * One line on a document (§G step 2).
 *
 * A delivery document shows goods and quantities and NO money anywhere
 * (§G, §I, §V) — so `amount` is optional and the money column simply does not
 * render when absent. There is no zero to print.
 */

import type { ReactNode } from 'react'

export interface LineItemRowProps {
  readonly description: string
  /** Already formatted through the locale layer. */
  readonly quantity: string
  /** Formatted money. Omitted entirely on a delivery document. */
  readonly amount?: string
  readonly unit?: string
  readonly photo?: ReactNode
  readonly onRemove?: () => void
  /** Accessible name for the remove control, in the active language. */
  readonly removeLabel?: string
}

export function LineItemRow({
  description,
  quantity,
  amount,
  unit,
  photo,
  onRemove,
  removeLabel,
}: LineItemRowProps) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3">
      {photo !== undefined && <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">{photo}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{description}</p>
        <p className="text-xs opacity-70">
          {quantity}
          {unit !== undefined && ` ${unit}`}
        </p>
      </div>
      {amount !== undefined && <p className="shrink-0 text-sm font-semibold tabular-nums">{amount}</p>}
      {onRemove !== undefined && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          // §F: tap targets ≥ 44px.
          className="min-h-tap min-w-tap shrink-0 rounded-full text-ink/50 hover:text-status-bad"
        >
          ×
        </button>
      )}
    </div>
  )
}
