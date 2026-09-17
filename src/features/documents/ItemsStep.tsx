/**
 * Step 2 — Items, or Goods on a delivery document (§G).
 *
 * "One input with autocomplete from the saved catalogue, quantity, unit price
 * (unit, for deliveries), +. New typed items join the catalogue with the price
 * used, and a toast says so."
 *
 * A delivery document has NO price field at all — not a disabled one, not a
 * zero. §V: "Delivery documents never show prices, tax, totals or payment
 * instructions — under any name." What it has instead is the UNIT, because
 * "3 cartons" is what somebody signs for and "3" is not.
 *
 * Laid out from the prototype: the description on its own line, then quantity
 * and price (or unit) side by side with a small `+` at the end of the row.
 * Three controls on one line rather than a full-width Add button beneath
 * them — adding a line is the action repeated most in the whole app, and
 * every row of vertical space here is a row of line items pushed off screen.
 */

import { useEffect, useRef, useState } from 'react'

import { useCompany } from '../../app/context'
import { EmptyState, Icon, TYPE_PALETTE } from '../../ui'
import { carriesMoney, quantity as toQuantity, type LineItem } from '../../domain/documents/types'
import type { SavedItem } from '../../data/repositories'
import { lineTotal } from '../../domain/money/totals'
import { money } from '../../domain/money/money'
import { formatMoney } from '../customers/formatMoney'
import { BuilderCard, TinyButton } from './BuilderCard'
import type { DocumentDraft } from './builder'

export interface ItemsStepProps {
  readonly draft: DocumentDraft
  readonly onChange: (patch: Partial<DocumentDraft>) => void
  /** Called when a typed item should join the catalogue (§L2). */
  readonly onRemember?: (item: { name: string; unitPriceMinor?: number; unit?: string }) => void
  /** §G: "a list icon jumps to Settings → Saved items". */
  readonly onOpenCatalogue?: () => void
}

let nextLineId = 0

export function ItemsStep({ draft, onChange, onRemember, onOpenCatalogue }: ItemsStepProps) {
  const { companyId, repositories, strings } = useCompany()
  const showsMoney = carriesMoney(draft.type)
  const { accent, tint } = TYPE_PALETTE[draft.type]

  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('')
  const [suggestions, setSuggestions] = useState<SavedItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const describe = useRef<HTMLInputElement>(null)

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
      ...(unit.trim() === '' ? {} : { unit: unit.trim() }),
    }
    onChange({ lineItems: [...draft.lineItems, line] })
    // THE UNIT GOES WITH IT. §E gives the catalogue a `unit` column and the
    // line above has just set one; dropping it here is why every saved item
    // had a price and no unit, and why the catalogue could never say
    // "per carton" the way §L2 intends it to.
    onRemember?.({
      name: line.description,
      ...(minor === undefined ? {} : { unitPriceMinor: minor }),
      ...(line.unit === undefined ? {} : { unit: line.unit }),
    })
    setDescription('')
    setQty('1')
    setPrice('')
    // The unit is NOT cleared. A delivery is usually cartons all the way
    // down, and retyping it on every line is the tax this field would
    // otherwise charge for existing.
    setShowSuggestions(false)
    describe.current?.focus()
  }

  /**
   * Taking a suggestion fills the price and the unit too — that is the point
   * of having saved it (§L2: "prices update next time").
   */
  const takeSuggestion = (item: SavedItem) => {
    setDescription(item.name)
    if (showsMoney && item.lastPrice !== undefined) setPrice(String(item.lastPrice.minor / 100))
    if (!showsMoney && item.unit !== undefined) setUnit(item.unit)
    setShowSuggestions(false)
    describe.current?.focus()
  }

  const visibleSuggestions = showSuggestions
    ? suggestions.filter((item) => item.name.toLocaleLowerCase() !== description.trim().toLocaleLowerCase())
    : []

  const title = showsMoney ? strings.items.addItem : strings.items.goods

  return (
    <div className="space-y-3">
      <BuilderCard
        title={title}
        icon="package"
        accent={accent}
        action={
          onOpenCatalogue === undefined ? undefined : (
            <TinyButton
              label={strings.settings.savedItems}
              icon="list"
              accent={accent}
              tint={tint}
              onClick={onOpenCatalogue}
            />
          )
        }
      >
        {/*
          WHAT IS TYPED COUNTS, WITHOUT PRESSING ADD.

          A line that has been filled in is a line the owner meant. Requiring
          `+` before it existed meant somebody who typed the goods and went
          straight to Next lost them — the commonest way to lose work in the
          builder, and exactly the kind of loss Rule #1 is about: the app
          asking for a gesture that carries no information.

          The listener is on the WHOLE entry block, description included, and
          `relatedTarget` is checked against it — moving from Description to
          Qty is still being in the row, and committing then would file half a
          line and clear the boxes under the owner's hands.

          `+` stays and still does something: it commits and puts the cursor
          back in Description, which is what somebody adding a tenth line
          wants. It is a shortcut now rather than a toll.
        */}
        <div
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return
            if (canAdd) add()
          }}
        >
        <div className="relative">
          <input
            ref={describe}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={strings.items.typeAnItem}
            aria-label={strings.items.description}
            className="sunken min-h-tap w-full rounded-[10px] px-2.5 text-[11.5px]"
          />

          {/*
            A list we draw, not a `<datalist>`.

            `datalist` is the tidier markup and it is the wrong choice here:
            Android's WebView renders it inconsistently and styles it not at
            all, so §G's "saved ones appear" would look different on every
            phone and identical to nothing on some. It also cannot carry the
            PRICE, which is half of what a saved item is for.
          */}
          {visibleSuggestions.length > 0 && (
            <ul className="glass-solid absolute inset-x-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-xl">
              {visibleSuggestions.map((item) => (
                <li key={item.id} className="border-b border-edge/5 last:border-0">
                  <button
                    type="button"
                    onClick={() => takeSuggestion(item)}
                    className="flex min-h-tap w-full items-center gap-2 px-2.5 py-2 text-start"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">
                      {item.name}
                    </span>
                    {showsMoney && item.lastPrice !== undefined && (
                      <span className="shrink-0 text-[10px] tabular-nums opacity-60">
                        {formatMoney(item.lastPrice)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/*
          WHAT IS TYPED COUNTS, WITHOUT PRESSING ADD.

          A line that has been filled in is a line the owner meant. Requiring
          `+` before it exists meant somebody who typed the goods and went
          straight to Next lost them — the commonest way to lose work in the
          builder, and the kind of loss Rule #1 is about: the app asking for a
          gesture that carries no information.

          So focus LEAVING the row commits it. `relatedTarget` is checked
          against the row itself, because moving from Description to Qty is
          still being in the row: committing then would file half a line and
          clear the boxes under the owner's hands.

          `+` stays, and still does something — it commits and puts the cursor
          back in Description, which is what somebody adding a tenth line
          wants. It is now a shortcut rather than a toll.
        */}
        <div className="flex items-end gap-1.5">
          {/*
            BOTH boxes are labelled, visibly.
            
            They were bare, on the grounds that the placeholder carried the
            meaning — and on a delivery that fails completely: the quantity
            shows "1" so its placeholder never appears, and beside it sits a
            box a person can easily read as a second number. Typing "10" into
            the unit gives a line reading "Bolt · 1 10", which is nobody's
            idea of a delivery note. A label costs fourteen pixels; the
            ambiguity costs the document.
          */}
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-[9.5px] opacity-55">{strings.items.quantity}</span>
            <input
              inputMode="decimal"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              aria-label={strings.items.quantity}
              className="sunken min-h-tap w-full rounded-[10px] px-2 text-center text-[11.5px]"
            />
          </label>

          {/*
            The PRICE, and only on a type that carries money.
            Never a disabled price on a delivery (§V).

            A delivery used to get a UNIT input here. The owner decided
            against the unit on waybills having used it, so a delivery row is
            description and quantity — and this column simply is not drawn for
            one, rather than being drawn empty. `unit` still exists on the
            model and on `SavedItem`; invoices and quotations still print it.
          */}
          {showsMoney && (
            <label className="block min-w-0 flex-[1.4]">
              <span className="mb-1 block text-[9.5px] opacity-55">
                {strings.items.unitPrice}
              </span>
              <input
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                aria-label={strings.items.unitPrice}
                className="sunken min-h-tap w-full rounded-[10px] px-2.5 text-[11.5px]"
              />
            </label>
          )}

          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            aria-label={strings.items.add}
            className="tap-scale grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] text-white disabled:opacity-40"
            style={{
              backgroundImage: `linear-gradient(160deg, ${accent}, ${accent})`,
              boxShadow: `0 3px 8px ${accent}4d, inset 0 1px 0 rgb(255 255 255 / 0.3)`,
            }}
          >
            <Icon name="plus" size={1.1} />
          </button>
        </div>
        </div>
      </BuilderCard>

      {draft.lineItems.length === 0 ? (
        <EmptyState title={strings.items.none} body={strings.items.noneBody} />
      ) : (
        <ul className="space-y-1.5">
          {draft.lineItems.map((line, index) => (
            <li
              key={line.id}
              className="glass flex items-center gap-2 rounded-xl px-2.5 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-semibold">
                  {line.description}
                </span>
                {/*
                  A delivery reads "3 cartons"; a money type reads "3 × ₦5,000".
                  The unit shows on both when it is there — "3 bags × ₦5,000"
                  is no worse on an invoice than it is on a delivery note.
                */}
                <span className="mt-0.5 block truncate text-[10px] opacity-55">
                  {[
                    `${line.quantityMilli / 1000}${line.unit === undefined ? '' : ` ${line.unit}`}`,
                    showsMoney && line.unitPriceMinor !== undefined
                      ? `× ${formatMoney(money(draft.currency, line.unitPriceMinor))}`
                      : '',
                  ]
                    .filter((part) => part !== '')
                    .join(' ')}
                </span>
              </span>

              {showsMoney && (
                <span className="shrink-0 text-[11.5px] font-semibold tabular-nums">
                  {formatMoney(lineTotal(draft.currency, line))}
                </span>
              )}

              <button
                type="button"
                onClick={() => onChange({ lineItems: draft.lineItems.filter((_, i) => i !== index) })}
                aria-label={`${strings.common.remove}: ${line.description}`}
                className="tap-scale grid min-h-tap min-w-tap shrink-0 place-items-center rounded-lg text-status-bad/70"
              >
                <Icon name="trash" size={0.9} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
