/**
 * Step 3 — Totals, or Dispatch on a delivery document (§G).
 *
 * "Subtotal, discount %, optional tax at the locale's label and — invoices
 * only — WHT where configured, live recalculation, heavy rule, payable total
 * in the type colour. Deliveries get driver and vehicle, no money."
 *
 * Every figure comes from `computeTotals`. This file does no arithmetic of its
 * own: Rule #4 means there is exactly one place money is calculated, and a
 * second implementation here could disagree with the PDF.
 *
 * The total's WORD changes with the type, and it is the same word the page
 * prints (§H): a quotation offers an "Estimated total" because it is an offer
 * and not a demand, a receipt states what was "Received" because the money has
 * already arrived, and only an invoice says "Payable".
 */

import { useEffect, useState } from 'react'

import { useCompany } from '../../app/context'
import { shared } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { TYPE_PALETTE } from '../../ui'
import { carriesMoney, type DocumentType } from '../../domain/documents/types'
import { computeTotals } from '../../domain/money/totals'
import { type Money, percentToPpm } from '../../domain/money/money'
import { parseAmount } from '../../domain/money/parse'
import { minorUnitsFor } from '../../domain/locale/bank-fields'
import { cashSaleSplit } from '../payments/cashSale'
import { majorFor } from '../payments/PayInvoice'
import { formatMoney } from '../customers/formatMoney'
import { BuilderCard } from './BuilderCard'
import type { DocumentDraft } from './builder'

export interface TotalsStepProps {
  readonly draft: DocumentDraft
  readonly discountPercent: number
  readonly taxPercent: number
  readonly whtPercent: number
  /** The locale's word for tax — VAT / GST / Sales tax / TVA (§J). */
  readonly taxLabel: string
  readonly onChange: (patch: Partial<DocumentDraft>) => void
  readonly onRates: (rates: {
    discountPercent?: number
    /** A rate for THIS document. Settings stays the only default (§J). */
    taxPercent?: number
    whtPercent?: number
  }) => void
}

/** One line of the totals block: a label, and a figure hard against the edge. */
function Line({
  label,
  value,
  tone,
  control,
  note,
}: {
  label: string
  value: string
  /** Coral for money coming OFF the bill, muted for tax, ink for the rest. */
  tone?: 'off' | 'muted' | undefined
  control?: React.ReactNode
  /**
   * Where the rate came from, under the label it explains.
   *
   * Quiet on purpose — it is the answer to a question somebody only asks when
   * a figure surprises them, and it should not compete with the figure.
   */
  note?: string | undefined
}) {
  const colour =
    tone === 'off' ? 'text-status-bad' : tone === 'muted' ? 'opacity-55' : 'font-medium'

  return (
    <div className="flex items-center justify-between gap-2 py-[5px] text-[11.5px]">
      <span className="min-w-0">
        <span className="block opacity-70">{label}</span>
        {note !== undefined && (
          <span className="block text-[9.5px] opacity-45">{note}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {control}
        <span className={`tabular-nums ${colour}`}>{value}</span>
      </span>
    </div>
  )
}

/** What the last line is called — the same word the page prints (§H). */
function totalLabel(
  type: DocumentType,
  profile: Parameters<typeof shared>[0],
  strings: ReturnType<typeof useCompany>['strings'],
): string {
  if (type === 'quotation') return shared(profile).estimatedTotal
  if (type === 'receipt') return strings.totals.received
  return strings.totals.payable
}

export function TotalsStep({
  draft,
  discountPercent,
  taxPercent,
  whtPercent,
  taxLabel,
  onChange,
  onRates,
}: TotalsStepProps) {
  const { profile, strings } = useCompany()
  const { accent, tint } = TYPE_PALETTE[draft.type]

  // A delivery document reaches this step for driver and vehicle only. There
  // is no money branch below it — not a zero total, no totals block at all.
  if (!carriesMoney(draft.type)) {
    return (
      <BuilderCard title={strings.totals.dispatch} icon="truck-delivery" accent={accent}>
        <div className="flex gap-2.5">
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-[9.5px] opacity-55">{strings.totals.driver}</span>
            <input
              value={draft.driverName ?? ''}
              onChange={(event) => onChange({ driverName: event.target.value })}
              aria-label={strings.totals.driver}
              className="sunken min-h-tap w-full rounded-[10px] px-2.5 text-[11.5px]"
            />
          </label>
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-[9.5px] opacity-55">{strings.totals.vehicle}</span>
            {/*
              A plate is NOT a name. §H's validation rule is that a driver is
              letters and spaces, while a registration mixes letters, digits
              and hyphens in a pattern that differs by country — so this field
              stays open rather than enforcing one market's shape on all of
              them (§J: never invent a rule for a country that lacks it).
            */}
            <input
              value={draft.vehicleNumber ?? ''}
              onChange={(event) => onChange({ vehicleNumber: event.target.value })}
              aria-label={strings.totals.vehicle}
              className="sunken min-h-tap w-full rounded-[10px] px-2.5 text-[11.5px] uppercase"
            />
          </label>
        </div>
        <p className="text-[10px] leading-relaxed opacity-45">
          {strings.totals.noMoneyOnDelivery}
        </p>
      </BuilderCard>
    )
  }

  const totals = computeTotals({
    type: draft.type,
    currency: draft.currency,
    lines: draft.lineItems,
    discountRate: percentToPpm(discountPercent),
    taxRate: percentToPpm(taxPercent),
    // §I: withholding tax is an invoice concept only.
    ...(draft.type === 'invoice' ? { whtRate: percentToPpm(whtPercent) } : {}),
  })

  const block = (
    <BuilderCard title={strings.totals.title} icon="calculator" accent={accent}>
      <div className="space-y-0">
        <Line label={strings.totals.subtotal} value={formatMoney(totals.subtotal)} />

        <Line
          label={strings.totals.discount}
          value={totals.discount.minor === 0 ? '—' : `−${formatMoney(totals.discount)}`}
          tone="off"
          control={
            <input
              inputMode="decimal"
              value={String(discountPercent)}
              onChange={(event) => onRates({ discountPercent: Number(event.target.value) || 0 })}
              aria-label={strings.totals.discount}
              className="sunken w-[52px] rounded-[9px] py-1.5 text-center text-[11.5px]"
            />
          }
        />

        {/*
          TAX AND WITHHOLDING, EDITABLE HERE — and every figure says where its
          rate came from (§K, §J).

          These were read-only, on the reasoning that a second editable copy
          would either change the company default from inside a document or
          invent a per-document override §E did not model. §E models it now,
          and the first half of that worry is answered by not doing it:
          editing here writes to THIS DOCUMENT only. Settings remains the one
          place the default changes.

          The provenance line is what makes it safe to touch. An owner who
          cannot see whether 7.5% came from their settings or from something
          they typed on this invoice last week is editing blind, and the two
          have completely different consequences for the next document.
        */}
        <Line
          label={format(strings.totals.atRate, { label: taxLabel, rate: taxPercent })}
          value={formatMoney(totals.tax)}
          tone={totals.tax.minor === 0 ? 'off' : undefined}
          note={draft.taxRatePpm === undefined ? strings.totals.fromSettings : strings.totals.onThisOne}
          control={
            <input
              inputMode="decimal"
              value={String(taxPercent)}
              onChange={(event) => onRates({ taxPercent: Number(event.target.value) || 0 })}
              aria-label={taxLabel}
              className="sunken w-[52px] rounded-[9px] py-1.5 text-center text-[11.5px]"
            />
          }
        />

        {/* Invoices only (§I): withholding is deducted from what is billed. */}
        {draft.type === 'invoice' && (
          <Line
            label={format(strings.totals.atRate, {
              label: strings.totals.withholding,
              rate: whtPercent,
            })}
            value={totals.wht.minor === 0 ? '—' : `−${formatMoney(totals.wht)}`}
            tone="off"
            note={
              draft.whtRatePpm === undefined ? strings.totals.fromSettings : strings.totals.onThisOne
            }
            control={
              <input
                inputMode="decimal"
                value={String(whtPercent)}
                onChange={(event) => onRates({ whtPercent: Number(event.target.value) || 0 })}
                aria-label={strings.totals.withholding}
                className="sunken w-[52px] rounded-[9px] py-1.5 text-center text-[11.5px]"
              />
            }
          />
        )}

        {/* §G's heavy rule, in the type's colour. */}
        <div className="my-1.5 border-t-2" style={{ borderColor: accent }} />

        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-[13px] font-semibold">
            {totalLabel(draft.type, profile, strings)}
          </span>
          <span
            data-totals-payable
            className="text-[18px] font-bold tabular-nums"
            style={{ color: accent }}
          >
            {formatMoney(totals.payable)}
          </span>
        </div>
      </div>

      {/* Where the rates come from, said once rather than guessed at. */}
      <p
        className="rounded-lg px-2.5 py-2 text-[10px] leading-relaxed"
        style={{ backgroundImage: `linear-gradient(180deg, ${tint}, transparent)` }}
      >
        {strings.totals.ratesFromSettings}
      </p>
    </BuilderCard>
  )

  /*
   * A CASH SALE ALSO ASKS WHAT WAS HANDED OVER (§G, §K).
   *
   * Only on a receipt that stands on its own — Path A takes its figures from
   * the invoice it settles and reaches no Totals step at all.
   *
   * A SEPARATE CARD, and the separation is the design. Everything in the
   * block above is COMPUTED: what the goods cost. This is STATED: what the
   * customer actually gave you. Putting it among the arithmetic would invite
   * somebody to read it as another adjustment to the price — and the price is
   * exactly what it must not touch.
   */
  if (draft.type !== 'receipt' || draft.linkedInvoiceId !== undefined) return block

  return (
    <>
      {block}
      <PaidNow draft={draft} total={totals.payable} onChange={onChange} />
    </>
  )
}

/**
 * What the customer handed over, and what it leaves.
 *
 * PREFILLED TO THE TOTAL, because paying in full is the common case and must
 * cost nothing — leave it alone and the receipt reads "Paid in full" and no
 * second document appears. It follows the total while nobody has touched it
 * and stops the moment somebody does: adding a line after typing "40000" must
 * not silently raise what they said they were paid.
 */
function PaidNow({
  draft,
  total,
  onChange,
}: {
  draft: DocumentDraft
  total: Money
  onChange: (patch: Partial<DocumentDraft>) => void
}) {
  const { strings } = useCompany()
  const { accent } = TYPE_PALETTE[draft.type]
  const scale = minorUnitsFor(draft.currency)

  const [touched, setTouched] = useState(false)
  const [typed, setTyped] = useState('')

  const paidMinor = touched ? (parseAmount(typed, { scale }) ?? 0) : total.minor
  const split = cashSaleSplit({ total, paidMinor })

  /*
   * The draft carries the figure, so the save path and the printed page read
   * what this field shows. In an effect because writing it during render
   * would be updating a parent mid-render, which React refuses.
   */
  useEffect(() => {
    if (draft.paidAmountMinor !== paidMinor) onChange({ paidAmountMinor: paidMinor })
  }, [draft.paidAmountMinor, paidMinor, onChange])

  return (
    <BuilderCard title={strings.totals.whatTheyPaid} icon="cash" accent={accent}>
      <div data-paid-section>
        <label className="block text-[11.5px] font-medium" htmlFor="receipt-paid-now">
          {strings.totals.paidNow}
        </label>
        <input
          id="receipt-paid-now"
          data-paid-now
          inputMode="decimal"
          className="sunken mt-1.5 min-h-tap w-full rounded-[10px] px-3 text-[17px] font-semibold tabular-nums"
          value={touched ? typed : majorFor(total)}
          onChange={(event) => {
            setTouched(true)
            setTyped(event.target.value)
          }}
        />
        <p className="mt-1.5 text-[10px] leading-relaxed opacity-60">
          {strings.totals.paidNowHint}
        </p>

        {/*
          WHAT HAPPENS NEXT, said before it happens rather than discovered in
          the invoices list afterwards (§N).
        */}
        <p
          data-paid-note
          className={`mt-2 text-[11.5px] font-medium ${
            split.paidInFull ? 'text-status-good' : 'text-status-warn'
          }`}
        >
          {split.paidInFull
            ? strings.newReceipt.clearsIt
            : format(strings.newReceipt.willBill, { amount: formatMoney(split.balance) })}
        </p>
      </div>
    </BuilderCard>
  )
}
