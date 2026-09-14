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

import { useCompany } from '../../app/context'
import { shared } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { TYPE_PALETTE } from '../../ui'
import { carriesMoney, type DocumentType } from '../../domain/documents/types'
import { computeTotals } from '../../domain/money/totals'
import { percentToPpm } from '../../domain/money/money'
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
  readonly onRates: (rates: { discountPercent?: number }) => void
}

/** One line of the totals block: a label, and a figure hard against the edge. */
function Line({
  label,
  value,
  tone,
  control,
}: {
  label: string
  value: string
  /** Coral for money coming OFF the bill, muted for tax, ink for the rest. */
  tone?: 'off' | 'muted'
  control?: React.ReactNode
}) {
  const colour =
    tone === 'off' ? 'text-status-bad' : tone === 'muted' ? 'opacity-55' : 'font-medium'

  return (
    <div className="flex items-center justify-between gap-2 py-[5px] text-[11.5px]">
      <span className="min-w-0 opacity-70">{label}</span>
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

  return (
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
          Tax and withholding are read from Settings rather than typed here.
          §G says "where configured" and §J puts the rates in one place with a
          worked example; a second editable copy in the builder would either
          silently change the company default from inside a document, or
          invent a per-document override that §E does not model. The RATE is
          shown so the figure is never unexplained.
        */}
        {totals.tax.minor !== 0 && (
          <Line
            label={format(strings.totals.atRate, { label: taxLabel, rate: taxPercent })}
            value={formatMoney(totals.tax)}
            tone="muted"
          />
        )}
        {totals.wht.minor !== 0 && (
          <Line
            label={format(strings.totals.atRate, {
              label: strings.totals.withholding,
              rate: whtPercent,
            })}
            value={`−${formatMoney(totals.wht)}`}
            tone="off"
          />
        )}

        {/* §G's heavy rule, in the type's colour. */}
        <div className="my-1.5 border-t-2" style={{ borderColor: accent }} />

        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-[13px] font-semibold">
            {totalLabel(draft.type, profile, strings)}
          </span>
          <span className="text-[18px] font-bold tabular-nums" style={{ color: accent }}>
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
}
