/**
 * Who is paying, when the money is towards something already billed (§G, §K).
 *
 * ONLY PEOPLE WHO ACTUALLY OWE, each with the figure beside their name.
 *
 * The old form offered every customer in the book from a dropdown, which put
 * the work on the owner: they had to remember who was behind, find them in an
 * alphabetical list, and only then discover whether this path was even the
 * right one. A list of debtors with amounts answers all three at once, and is
 * the shortest thing that can.
 *
 * It is built from the same `SettleableInvoice` set the form applies against,
 * so the names here and the invoices there cannot disagree about who owes
 * what — one computation, read twice.
 */

import type { ReactNode } from 'react'

import { useCompany } from '../../app/context'
import { type Money, money } from '../../domain/money/money'
import { format } from '../../domain/locale/data/strings'
import { formatMoney } from '../customers/formatMoney'
import type { Customer } from '../../data/repositories'
import type { SettleableInvoice } from './receiptFlow'

export interface OwedPickerProps {
  readonly customers: readonly Customer[]
  readonly invoices: readonly SettleableInvoice[]
  readonly currency: string
  readonly onPick: (customerId: string) => void
  readonly onBack: () => void
}

/** A debtor and what they owe, in the currency the money is coming in. */
export interface Debtor {
  readonly id: string
  readonly name: string
  readonly owed: Money
}

/**
 * Who owes something, most owing first.
 *
 * Ordered by amount rather than alphabetically: somebody paying off a debt is
 * far more often one of the larger ones, and a list a person scans top-down
 * should put the likely answer where they look first. Alphabetical order is
 * only useful to somebody who already knows the name, and they can read.
 */
export function debtorsFrom(
  customers: readonly Customer[],
  invoices: readonly SettleableInvoice[],
  currency: string,
): Debtor[] {
  const owedBy = new Map<string, number>()
  for (const invoice of invoices) {
    if (invoice.outstanding.currency !== currency) continue
    if (invoice.outstanding.minor <= 0) continue
    owedBy.set(invoice.customerId, (owedBy.get(invoice.customerId) ?? 0) + invoice.outstanding.minor)
  }

  return [...owedBy]
    .flatMap(([id, minor]) => {
      const customer = customers.find((row) => row.id === id)
      // A balance whose customer is gone is not something anybody can pay.
      return customer === undefined ? [] : [{ id, name: customer.name, owed: money(currency, minor) }]
    })
    .sort((a, b) => b.owed.minor - a.owed.minor)
}

export function OwedPicker({
  customers,
  invoices,
  currency,
  onPick,
  onBack,
}: OwedPickerProps): ReactNode {
  const { strings } = useCompany()
  const r = strings.newReceipt
  const debtors = debtorsFrom(customers, invoices, currency)

  return (
    <section className="glass-solid rounded-2xl p-4" aria-label={r.pickWhoOwes}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{r.pickWhoOwes}</h2>
        <button
          type="button"
          onClick={onBack}
          className="min-h-tap text-[13px] font-semibold text-brand"
        >
          {strings.common.back}
        </button>
      </div>

      {debtors.length === 0 ? (
        <p className="mt-3 text-xs opacity-60">{r.nobodyOwes}</p>
      ) : (
        <ul className="mt-3 space-y-1.5" role="list">
          {debtors.map((debtor) => (
            <li key={debtor.id}>
              <button
                type="button"
                onClick={() => onPick(debtor.id)}
                className="raised tap-scale flex min-h-tap w-full items-center justify-between gap-3 rounded-xl bg-surface px-3 text-start text-sm"
              >
                {/*
                  The NAME and the FIGURE, one control. Splitting them into a
                  row and a caption would make the amount look like help text
                  about the name; it is the reason this row exists.
                */}
                <span className="min-w-0 truncate font-semibold">{debtor.name}</span>
                <span className="shrink-0 font-semibold tabular-nums opacity-75">
                  {formatMoney(debtor.owed)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Exported for the label, so the words stay in the catalogue (Rule #4). */
export const debtorLine = (
  template: string,
  debtor: Debtor,
): string => format(template, { name: debtor.name, amount: formatMoney(debtor.owed) })
