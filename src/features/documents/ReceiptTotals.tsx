/**
 * What the goods come to, and what was actually handed over (§G, §K, §V).
 *
 * NOT A TOTALS STEP COMING BACK. A receipt has nothing to compute — no tax to
 * apply, no discount to argue about, no subtotal that differs from the total —
 * which is why the step was dropped, and dropping it was right. What it left
 * behind was smaller and real: Path B has ITEMS, and somebody typing them had
 * no way to see what they add up to until the document was saved.
 *
 * So this is two lines at the foot of the list. The sum, and one field.
 *
 * THE FIELD IS PREFILLED TO THE SUM, because a cash sale paid in full is the
 * common case and must cost no taps at all — type the goods, save, done, and
 * the receipt reads "Paid in full". Changing it is what says a customer walked
 * away owing something, and the app then bills that properly rather than
 * letting a real debt exist only in the owner's memory.
 *
 * It follows the sum while nobody has touched it and stops the moment somebody
 * does. Adding a line after typing "40000" must not silently raise what they
 * said they were paid.
 */

import { useEffect, useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { money } from '../../domain/money/money'
import { parseAmount } from '../../domain/money/parse'
import { minorUnitsFor } from '../../domain/locale/bank-fields'
import { cashSaleSplit, saleTotal } from '../payments/cashSale'
import { formatMoney } from '../customers/formatMoney'
import { majorFor } from '../payments/PayInvoice'
import type { DocumentDraft } from './builder'

export interface ReceiptTotalsProps {
  readonly draft: DocumentDraft
  readonly onChange: (patch: Partial<DocumentDraft>) => void
}

export function ReceiptTotals({ draft, onChange }: ReceiptTotalsProps) {
  const { strings } = useCompany()
  const r = strings.newReceipt
  const scale = minorUnitsFor(draft.currency)

  const total = saleTotal(draft.currency, draft.lineItems)
  /**
   * Whether the figure is the person's own.
   *
   * Local, not on the draft: "did somebody type this" is a fact about this
   * visit to the screen, and storing it would make a reopened document
   * remember a decision nobody is still making.
   */
  const [touched, setTouched] = useState(false)
  const [typed, setTyped] = useState('')

  const paidMinor = touched ? (parseAmount(typed, { scale }) ?? 0) : total.minor
  const split = cashSaleSplit({ total, paidMinor })

  /*
   * THE DRAFT CARRIES THE FIGURE, so the save path and the printed page read
   * the same number this field shows.
   *
   * In an effect because writing it during render would be updating a PARENT
   * mid-render, which React refuses. Guarded on the value rather than run
   * every time, so a draft that already agrees is not rewritten — and
   * `onChange` marks the draft dirty, which would otherwise mean every visit
   * to this step saved a document nobody had edited.
   */
  useEffect(() => {
    if (draft.paidAmountMinor !== paidMinor) onChange({ paidAmountMinor: paidMinor })
  }, [draft.paidAmountMinor, paidMinor, onChange])

  return (
    <section
      data-receipt-totals
      className="glass mt-3 rounded-2xl px-3.5 py-3"
      aria-label={r.saleTotal}
    >
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="opacity-70">{r.saleTotal}</span>
        <span data-sale-total className="font-semibold tabular-nums">
          {formatMoney(total)}
        </span>
      </p>

      <label className="mt-2.5 block text-xs font-medium opacity-70" htmlFor="receipt-paid-now">
        {r.paidNow}
      </label>
      <input
        id="receipt-paid-now"
        data-paid-now
        inputMode="decimal"
        className="sunken mt-1 min-h-tap w-full rounded-lg px-3 text-base tabular-nums"
        value={touched ? typed : majorFor(total)}
        onChange={(event) => {
          setTouched(true)
          setTyped(event.target.value)
        }}
      />

      {/*
        WHAT HAPPENS NEXT, said before it happens rather than discovered in the
        documents list afterwards. A second document appearing unannounced is
        the kind of surprise §N exists to prevent — and the sentence is also
        the explanation of why the app is allowed to create one.
      */}
      <p data-paid-note className="mt-1.5 text-[11.5px] opacity-70">
        {split.paidInFull
          ? r.clearsIt
          : format(r.willBill, { amount: formatMoney(money(draft.currency, split.balance.minor)) })}
      </p>
    </section>
  )
}
