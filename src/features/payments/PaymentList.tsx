/**
 * The payments list and the prefilled sheet (§G, §L3).
 *
 * "Payments listed with date, method, reference, each with its own 'Receipt'
 * button. `+` opens a sheet prefilled to the balance; a changed amount is a
 * part payment."
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { EmptyState } from '../../ui'
import { label as typeLabel } from '../../domain/locale/profile'
import type { Money } from '../../domain/money/money'
import { money } from '../../domain/money/money'
import { effectivePayments, type Payment } from '../../domain/payments/ledger'
import { formatMoney } from '../customers/formatMoney'
import { methodName } from './methods'

export interface PaymentListProps {
  readonly payments: readonly Payment[]
  readonly prefill: Money
  readonly onRecord: (input: { amount: Money; method: string; reference?: string }) => void
  readonly onReceipt: (payment: Payment) => void
}

export function PaymentList({ payments, prefill, onRecord, onReceipt }: PaymentListProps) {
  const { profile, strings } = useCompany()
  // Rule #4: the word on this button is the type's own label, resolved through
  // the terminology table — not a UI string. A Nigerian owner reading English
  // and a Mexican owner reading English do not see the same word here, and
  // that is the whole point of §D.
  const receiptLabel = typeLabel(profile, 'receipt')
  const [open, setOpen] = useState(false)
  // Prefilled to the balance (§G). Changing it downward is a part payment,
  // which needs no separate control — it is the same field with a smaller sum.
  const [amount, setAmount] = useState(String(prefill.minor / 100))
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')

  const settled = effectivePayments([...payments])

  return (
    <section className="space-y-3">
      {settled.length === 0 ? (
        <EmptyState title={strings.payments.none} body={strings.payments.noneBody} />
      ) : (
        <ul className="space-y-2">
          {settled.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center gap-3 rounded-2xl bg-surface/85 p-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold tabular-nums">
                  {formatMoney(payment.amount)}
                </span>
                <span className="block truncate text-xs opacity-70">
                  {payment.paidAt.slice(0, 10)} · {methodName(strings, payment.method)}
                  {payment.reference !== undefined && ` · ${payment.reference}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onReceipt(payment)}
                className="min-h-tap shrink-0 rounded-full bg-receipt-tint px-3 text-xs font-semibold text-receipt-accent"
              >
                {receiptLabel}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-tap w-full rounded-full bg-brand text-sm font-semibold text-white"
      >
        {strings.payments.recordPayment}
      </button>

      {open && (
        <div className="space-y-3 rounded-2xl bg-surface/90 p-4" role="dialog" aria-label={strings.payments.recordPayment}>
          <label className="block">
            <span className="mb-1 block text-xs font-medium opacity-70">
              {strings.payments.amount}
            </span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-label={strings.payments.amount}
              className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium opacity-70">
              {strings.payments.reference}
            </span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              aria-label={strings.payments.reference}
              className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
            />
          </label>
          <p className="text-xs opacity-60">{strings.payments.partPaymentNote}</p>
          <button
            type="button"
            onClick={() => {
              onRecord({
                amount: money(prefill.currency, Math.round(Number(amount) * 100)),
                method,
                ...(reference.trim() === '' ? {} : { reference: reference.trim() }),
              })
              setOpen(false)
              setMethod('bank_transfer')
              setReference('')
            }}
            className="min-h-tap w-full rounded-full bg-brand text-sm font-semibold text-white"
          >
            {strings.payments.save}
          </button>
        </div>
      )}
    </section>
  )
}
