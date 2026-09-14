/**
 * Step 2 — Items, or Goods on a delivery document (§G).
 *
 * "One input with autocomplete from the saved catalogue, quantity, unit price
 * (unit, for deliveries), +. New typed items join the catalogue with the price
 * used, and a toast says so."
 *
 * A delivery document has NO price field at all — not a disabled one, not a
 * zero. §V: "Delivery documents never show prices, tax, totals or payment
 * instructions — under any name."
 */

import { useEffect, useState } from 'react'

import { useCompany } from '../../app/context'
import { EmptyState, LineItemRow } from '../../ui'
import { carriesMoney, quantity as toQuantity, type LineItem } from '../../domain/documents/types'
import type { SavedItem } from '../../data/repositories'
import { lineTotal } from '../../domain/money/totals'
import { formatMoney } from '../customers/formatMoney'
import type { DocumentDraft } from './builder'

export interface ItemsStepProps {
  readonly draft: DocumentDraft
  readonly onChange: (patch: Partial<DocumentDraft>) => void
  /** Called when a typed item should join the catalogue (§L2). */
  readonly onRemember?: (item: { name: string; unitPriceMinor?: number }) => void
}

let nextLineId = 0

export function ItemsStep({ draft, onChange, onRemember }: ItemsStepProps) {
  const { companyId, repositories, strings } = useCompany()
  const showsMoney = carriesMoney(draft.type)

  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [suggestions, setSuggestions] = useState<SavedItem[]>([])

  useEffect(() => {
    let live = true
    void repositories.items.suggest(companyId, description).then((rows) => {
      if (live) setSuggestions(rows)
    })
    return () => {
      live = false
    }
  }, [companyId, repositories, description])

  const canAdd = description.trim() !== '' && (!showsMoney || price.trim() !== '')

  const add = () => {
    if (!canAdd) return
    const minor = showsMoney ? Math.round(Number(price) * 100) : undefined
    const line: LineItem = {
      id: `line_${++nextLineId}`,
      description: description.trim(),
      quantityMilli: toQuantity(Number(qty) || 1),
      taxable: true,
      ...(minor === undefined ? {} : { unitPriceMinor: minor }),
    }
    onChange({ lineItems: [...draft.lineItems, line] })
    onRemember?.({ name: line.description, ...(minor === undefined ? {} : { unitPriceMinor: minor }) })
    setDescription('')
    setQty('1')
    setPrice('')
  }

  return (
    <div className="space-y-4">
      <section className="glass-solid space-y-3 rounded-2xl p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium opacity-70">
            {strings.items.description}
          </span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-label={strings.items.description}
            list="docflow-item-suggestions"
            className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
          />
        </label>
        <datalist id="docflow-item-suggestions">
          {suggestions.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>

        <div className="flex gap-3">
          <label className="block w-24">
            <span className="mb-1 block text-xs font-medium opacity-70">
              {strings.items.quantity}
            </span>
            <input
              inputMode="decimal"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              aria-label={strings.items.quantity}
              className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
            />
          </label>

          {/* No price field at all on a delivery document (§G, §V). */}
          {showsMoney && (
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium opacity-70">
                {strings.items.unitPrice}
              </span>
              <input
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                aria-label={strings.items.unitPrice}
                className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
              />
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="raised tap-scale min-h-tap w-full rounded-full bg-gradient-to-b from-brand-light to-brand text-sm font-semibold text-white disabled:opacity-40"
        >
          {strings.items.add}
        </button>
      </section>

      {draft.lineItems.length === 0 ? (
        <EmptyState title={strings.items.none} body={strings.items.noneBody} />
      ) : (
        <ul className="space-y-2">
          {draft.lineItems.map((line, index) => (
            <li key={line.id}>
              <LineItemRow
                description={line.description}
                quantity={String(line.quantityMilli / 1000)}
                {...(showsMoney
                  ? { amount: formatMoney(lineTotal(draft.currency, line)) }
                  : {})}
                removeLabel={strings.common.remove}
                onRemove={() =>
                  onChange({ lineItems: draft.lineItems.filter((_, i) => i !== index) })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
