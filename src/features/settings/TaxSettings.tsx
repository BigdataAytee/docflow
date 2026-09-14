/**
 * Settings → Tax (§G).
 *
 * "Locale-labelled rates with a live worked example."
 *
 * The example is computed by `computeTotals`, not by arithmetic written here.
 * Rule #4 allows exactly one place money is calculated, and a worked example
 * that disagreed with the document it is explaining would be worse than none.
 */

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { computeTotals } from '../../domain/money/totals'
import { percentToPpm } from '../../domain/money/money'
import { quantity } from '../../domain/documents/types'
import { formatMoney } from '../customers/formatMoney'

export interface TaxSettingsProps {
  /** VAT / GST / Sales tax / TVA — from the region profile (§D). */
  readonly taxLabel: string
  readonly currency: string
  readonly taxPercent: number
  readonly whtPercent: number
  readonly onTaxPercent: (value: number) => void
  readonly onWhtPercent: (value: number) => void
}

/** A round number, so the example teaches the rates rather than the arithmetic. */
const EXAMPLE_MINOR = 10_000_00

export function TaxSettings({
  taxLabel,
  currency,
  taxPercent,
  whtPercent,
  onTaxPercent,
  onWhtPercent,
}: TaxSettingsProps) {
  const { strings } = useCompany()

  const totals = computeTotals({
    type: 'invoice',
    currency,
    lines: [
      {
        id: 'example',
        description: 'example',
        quantityMilli: quantity(1),
        unitPriceMinor: EXAMPLE_MINOR,
        taxable: true,
      },
    ],
    taxRate: percentToPpm(taxPercent),
    whtRate: percentToPpm(whtPercent),
  })

  return (
    <section className="space-y-4 px-4 py-4">
      <h1 className="text-lg font-bold">{strings.settings.tax}</h1>

      <div className="glass-solid space-y-3 rounded-2xl p-4">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm opacity-70">
            {format(strings.settings.taxRate, { label: taxLabel })}
          </span>
          <input
            inputMode="decimal"
            value={String(taxPercent)}
            onChange={(event) => onTaxPercent(Number(event.target.value) || 0)}
            aria-label={format(strings.settings.taxRate, { label: taxLabel })}
            className="sunken min-h-tap w-20 max-w-[45%] shrink rounded-lg px-3 text-end text-sm"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm opacity-70">{strings.settings.withholdingRate}</span>
          <input
            inputMode="decimal"
            value={String(whtPercent)}
            onChange={(event) => onWhtPercent(Number(event.target.value) || 0)}
            aria-label={strings.settings.withholdingRate}
            className="sunken min-h-tap w-20 max-w-[45%] shrink rounded-lg px-3 text-end text-sm"
          />
        </label>
      </div>

      <p className="rounded-2xl bg-brand-tint p-3 text-xs text-brand-deep" role="status">
        {format(strings.settings.workedExample, {
          subtotal: formatMoney(totals.subtotal),
          tax: formatMoney(totals.tax),
          wht: formatMoney(totals.wht),
          payable: formatMoney(totals.payable),
        })}
      </p>
    </section>
  )
}
