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
 */

import { useCompany } from '../../app/context'
import { TYPE_PALETTE } from '../../ui'
import { carriesMoney } from '../../domain/documents/types'
import { computeTotals } from '../../domain/money/totals'
import { percentToPpm } from '../../domain/money/money'
import { formatMoney } from '../customers/formatMoney'
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${strong === true ? 'font-bold' : ''}`}>
      <span className={strong === true ? '' : 'opacity-70'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
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
  const { strings } = useCompany()
  const accent = TYPE_PALETTE[draft.type].accent

  // A delivery document reaches this step for driver and vehicle only. There
  // is no money branch below it — not a zero total, no totals block at all.
  if (!carriesMoney(draft.type)) {
    return (
      <div className="space-y-3 rounded-2xl bg-white/85 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium opacity-70">{strings.totals.driver}</span>
          <input
            value={draft.driverName ?? ''}
            onChange={(event) => onChange({ driverName: event.target.value })}
            aria-label={strings.totals.driver}
            className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
          />
        </label>
        <p className="text-xs opacity-60">{strings.totals.noMoneyOnDelivery}</p>
      </div>
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
    <div className="space-y-3 rounded-2xl bg-white/85 p-4">
      <Row label={strings.totals.subtotal} value={formatMoney(totals.subtotal)} />

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="opacity-70">{strings.totals.discount}</span>
        <input
          inputMode="decimal"
          value={String(discountPercent)}
          onChange={(event) => onRates({ discountPercent: Number(event.target.value) || 0 })}
          aria-label={strings.totals.discount}
          className="min-h-tap w-20 rounded-lg bg-page px-3 text-end text-sm shadow-inner"
        />
      </label>
      {totals.discount.minor !== 0 && (
        <Row label={strings.totals.discount} value={`−${formatMoney(totals.discount)}`} />
      )}

      {totals.tax.minor !== 0 && <Row label={taxLabel} value={formatMoney(totals.tax)} />}
      {totals.wht.minor !== 0 && (
        <Row label={strings.totals.withholding} value={`−${formatMoney(totals.wht)}`} />
      )}

      <div className="border-t-2 border-navy/20 pt-3">
        <div className="flex justify-between text-base font-bold" style={{ color: accent }}>
          <span>{strings.totals.payable}</span>
          <span className="tabular-nums">{formatMoney(totals.payable)}</span>
        </div>
      </div>
    </div>
  )
}
