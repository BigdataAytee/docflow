/**
 * Which bill this money is paying (§G, Rule #1).
 *
 * THE ROW HAS TO BE RECOGNISABLE. The list this replaces printed a reference
 * and a balance — "INV-0007 · ₦95,000 left" — and a trader with four bills out
 * to the same customer cannot tell INV-0007 from INV-0009 by their numbers.
 * What they remember is the JOB and roughly WHEN, so the row leads with the
 * goods and the date, and carries the reference, the face value and what is
 * still owing beside them.
 *
 * The face value AND the balance, not one of them: "₦200,000, ₦95,000 left"
 * says a part payment already happened, which is exactly the situation
 * somebody is in when they reach this screen. The balance alone hides it.
 */

import type { ReactNode } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { formatDocumentDate } from '../../domain/locale/dates'
import type { LineItem } from '../../domain/documents/types'
import { formatMoney } from '../customers/formatMoney'
import type { SettleableInvoice } from './receiptFlow'

export interface InvoicePickerProps {
  readonly payerName: string
  readonly invoices: readonly SettleableInvoice[]
  readonly onPick: (invoice: SettleableInvoice) => void
  readonly onBack: () => void
  /** The company's own date format, so the row reads like the printed page. */
  readonly dateFormat?: string
}

/**
 * What the bill was for, in one line.
 *
 * The first item's own words, because that is what the owner wrote and what
 * they will recognise; the rest counted rather than listed, because a row that
 * wraps to four lines is a row nobody scans. Empty when the invoice somehow
 * has no goods — a blank space says less wrongly than "0 items" does.
 */
export function whatItWasFor(lineItems: readonly LineItem[], andMore: string): string {
  const first = lineItems[0]
  if (first === undefined) return ''
  const rest = lineItems.length - 1
  return rest === 0 ? first.description : `${first.description} ${format(andMore, { count: String(rest) })}`
}

export function InvoicePicker({
  payerName,
  invoices,
  onPick,
  onBack,
  dateFormat,
}: InvoicePickerProps): ReactNode {
  const { strings } = useCompany()
  const r = strings.newReceipt

  return (
    <section className="glass-solid rounded-2xl p-4" aria-label={r.pickInvoice}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{r.pickInvoice}</h2>
          <p className="truncate text-xs opacity-70">{payerName}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="min-h-tap shrink-0 text-[13px] font-semibold text-brand"
        >
          {strings.common.back}
        </button>
      </div>

      <ul className="mt-3 space-y-2" role="list">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <button
              type="button"
              data-invoice-row={invoice.id}
              onClick={() => onPick(invoice)}
              className="raised tap-scale w-full rounded-xl bg-surface p-3 text-start"
            >
              {/*
                THE GOODS FIRST, in the owner's own words. The reference is a
                number the app invented; the job is the thing they remember.
              */}
              <p className="truncate text-sm font-semibold leading-snug">
                {whatItWasFor(invoice.lineItems, r.andMoreItems)}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] opacity-65">
                {invoice.reference} · {formatDocumentDate(invoice.issueDate, dateFormat)}
              </p>
              {/*
                BOTH FIGURES. The face value beside the balance is what says a
                part payment already happened — the balance alone hides it,
                and hiding it is how somebody pays the same money twice.
              */}
              <p className="mt-1.5 flex items-baseline justify-between gap-3 text-[12.5px] tabular-nums">
                <span className="opacity-65">
                  {format(r.originalTotal, { amount: formatMoney(invoice.total) })}
                </span>
                <span className="font-semibold text-brand">
                  {format(r.owingLine, { amount: formatMoney(invoice.outstanding) })}
                </span>
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
