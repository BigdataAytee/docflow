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
import {
  carriesItemPhotos,
  carriesMoney,
  quantity as toQuantity,
  type LineItem,
} from '../../domain/documents/types'
import { ItemPhoto } from '../photos/ItemPhoto'
import { isGeneratedLine } from '../payments/receiptFlow'
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
  /**
   * Stores a line's photo and gives back its asset id (§P).
   *
   * The screen never holds the image: it hands over the shrunk data URL and
   * gets an id back, exactly as the signature pad does. A line pointing at an
   * asset the repository never accepted would print a broken thumbnail on a
   * document claiming to show the goods.
   */
  readonly onStorePhoto?: (dataUrl: string) => Promise<string>
  /** The stored photos, by asset id, so a row can draw the one it has. */
  readonly photoUrls?: Readonly<Record<string, string>>
}

let nextLineId = 0

export function ItemsStep({
  draft,
  onChange,
  onRemember,
  onOpenCatalogue,
  onStorePhoto,
  photoUrls = {},
}: ItemsStepProps) {
  const { companyId, repositories, strings } = useCompany()
  const showsMoney = carriesMoney(draft.type)
  /*
   * A RECEIPT SHOWS NO PICTURES OF MERCHANDISE.
   *
   * It is evidence that money arrived, and the goods were described on the
   * invoice it settles — which carries the photographs already. The rule
   * lives in the domain beside `carriesMoney`, so the builder and the printed
   * page cannot come to different conclusions about the same document.
   */
  const showsPhotos = carriesItemPhotos(draft.type) && onStorePhoto !== undefined
  const { accent, ink, tint } = TYPE_PALETTE[draft.type]

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
      /*
       * NO UNIT ON A DELIVERY, not even one that arrived by the back door.
       *
       * The input is not drawn for a delivery, so `unit` should be empty —
       * except `takeSuggestion` was still filling it from the catalogue on
       * exactly that branch, left over from when a waybill did have the
       * field. So picking a saved item put a unit on a delivery line that the
       * owner could not see, could not clear, and would never have typed.
       *
       * It was invisible on the PDF, which drops the column, and visible in
       * the row summary right here — the builder read "3 cartons" under a
       * document that would print "3". Guarded by `showsMoney` rather than by
       * clearing the state, because state that is never read is the next
       * person's puzzle.
       */
      ...(!showsMoney || unit.trim() === '' ? {} : { unit: unit.trim() }),
    }
    /*
     * THE STAND-IN GOES WHEN A REAL LINE ARRIVES (§V).
     *
     * A cash receipt opens holding one generated line at the amount handed
     * over, so it can print something if the owner itemises nothing. It is a
     * placeholder: leaving it in place while goods are typed beside it made a
     * ₦100,000 sale add up to ₦200,000, which the new totals block then billed
     * a customer for.
     */
    const standing = draft.lineItems.filter((row) => !isGeneratedLine(row, draft.paymentId))
    onChange({ lineItems: [...standing, line] })
    // THE UNIT GOES WITH IT. §E gives the catalogue a `unit` column and the
    // line above has just set one; dropping it here is why every saved item
    // had a price and no unit, and why the catalogue could never say
    // "per carton" the way §L2 intends it to.
    /*
     * The catalogue learns what this screen actually collected.
     *
     * A delivery collects no unit, so it teaches none — otherwise a waybill
     * would be writing a `SavedItem.unit` out of a field it does not draw,
     * and the catalogue would be carrying a fact nobody entered.
     */
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
    // The unit comes back on a type that still has the field. A delivery does
    // not, so taking a suggestion on one fills the description and nothing else.
    if (showsMoney && item.unit !== undefined) setUnit(item.unit)
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
        ink={ink}
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
                      <span className="shrink-0 text-[10px] tabular-nums opacity-70">
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
            <span className="mb-1 block text-[9.5px] opacity-70">{strings.items.quantity}</span>
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
              <span className="mb-1 block text-[9.5px] opacity-70">
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
            className="tap-scale grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] text-white disabled:opacity-70"
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
                  A money type reads "3 bags × ₦5,000"; a delivery reads "3".
                  THE SUMMARY HAS TO MATCH THE PAPER. This printed the unit on
                  every type, so a delivery row read "3 cartons" in the builder
                  under a document whose table prints "3" — the builder
                  promising a column the page does not have.
                */}
                <span className="mt-0.5 block truncate text-[10px] opacity-70">
                  {[
                    `${line.quantityMilli / 1000}${
                      !showsMoney || line.unit === undefined ? '' : ` ${line.unit}`
                    }`,
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

              {/*
                THE PICTURE OF THE GOODS (§G step 2, §I).

                At the END of the row, the size of the delete button beside
                it, and drawn at 45% opacity when empty. A row with no photo
                has to read as finished rather than as a form somebody did
                not complete — Rule #1's "ignoring it costs nothing" is about
                what the screen looks like as much as what it asks for.
              */}
              {showsPhotos && (
                <ItemPhoto
                  itemName={line.description}
                  {...(line.imageAssetId === undefined ||
                  photoUrls[line.imageAssetId] === undefined
                    ? {}
                    : { currentUrl: photoUrls[line.imageAssetId] })}
                  onPhoto={async (dataUrl) => {
                    const assetId = await onStorePhoto(dataUrl)
                    onChange({
                      lineItems: draft.lineItems.map((row, i) =>
                        i === index ? { ...row, imageAssetId: assetId } : row,
                      ),
                    })
                  }}
                  onRemove={() =>
                    onChange({
                      lineItems: draft.lineItems.map((row, i) => {
                        if (i !== index) return row
                        // The FIELD goes, not an empty string in it: a line
                        // carrying `imageAssetId: ''` reads as one with a
                        // photo everywhere that checks for the field.
                        const { imageAssetId: _gone, ...rest } = row
                        return rest
                      }),
                    })
                  }
                />
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
