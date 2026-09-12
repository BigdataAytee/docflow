/**
 * Starting a receipt (§G, §K).
 *
 * "Starting one from Home records a payment first, optionally linked to an
 * invoice or standing alone, never inventing a duplicate invoice."
 *
 * So this sheet is a PAYMENT form that happens to lead to a document. The
 * order is the point: money is recorded, and the receipt is evidence of it.
 * Nothing here can produce a document without producing the payment.
 *
 * "Standing alone" is offered as a first-class choice with its own note,
 * because an owner who picks it should know exactly what happens — the money
 * becomes customer credit (§K) and no invoice appears from nowhere.
 */

import { useId, useState } from 'react'

import { useCompany } from '../../app/context'
import { type Money, money } from '../../domain/money/money'
import { minorUnitsFor } from '../../domain/locale/bank-fields'
import type { Customer } from '../../data/repositories'
import { formatMoney } from '../customers/formatMoney'
import type { SettleableInvoice } from './receiptFlow'
import { settleableInvoices } from './receiptFlow'

export interface NewReceiptSheetProps {
  readonly currency: string
  readonly today: string
  readonly customers: readonly Customer[]
  readonly invoices: readonly SettleableInvoice[]
  /** §J's enabled methods, already named in the active language. */
  readonly methods: readonly { id: string; name: string }[]
  readonly onRecord: (input: {
    customerId: string
    amount: Money
    paidAt: string
    method: string
    reference?: string
    invoiceId?: string
  }) => void
  readonly onClose: () => void
  readonly error?: string
}

export function NewReceiptSheet({
  currency,
  today,
  customers,
  invoices,
  methods,
  onRecord,
  onClose,
  error,
}: NewReceiptSheetProps) {
  const { strings } = useCompany()
  const r = strings.newReceipt
  const ids = useId()

  const [customerId, setCustomerId] = useState('')
  const [major, setMajor] = useState('')
  const [paidAt, setPaidAt] = useState(today)
  const [method, setMethod] = useState(methods[0]?.id ?? 'cash')
  const [reference, setReference] = useState('')
  const [invoiceId, setInvoiceId] = useState('')

  const scale = minorUnitsFor(currency)
  const parsed = Number.parseFloat(major.replace(/,/g, ''))
  const minor = Number.isFinite(parsed) ? Math.round(parsed * scale) : 0

  // Only what this money could actually settle: the payer's own balances, in
  // the currency handed over (§G — "offers only what makes sense").
  const options = settleableInvoices(invoices, customerId, currency)

  const canRecord = minor > 0 && customerId !== ''

  return (
    <section className="rounded-2xl bg-white/85 p-4 backdrop-blur" aria-label={r.title}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{r.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="min-h-tap min-w-tap text-lg leading-none opacity-60"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs opacity-70">{r.explain}</p>

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-who`}>
        {r.whoPaid}
      </label>
      <select
        id={`${ids}-who`}
        className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
        value={customerId}
        onChange={(event) => {
          setCustomerId(event.target.value)
          // A balance chosen for the previous payer must not survive the
          // change — that would allocate this money to someone else's debt.
          setInvoiceId('')
        }}
      >
        <option value="">—</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-amount`}>
        {r.amount}
      </label>
      <input
        id={`${ids}-amount`}
        className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-lg tabular-nums"
        inputMode="decimal"
        value={major}
        onChange={(event) => setMajor(event.target.value)}
      />

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-when`}>
        {r.datePaid}
      </label>
      <input
        id={`${ids}-when`}
        type="date"
        className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
        value={paidAt}
        onChange={(event) => setPaidAt(event.target.value)}
      />

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-how`}>
        {r.method}
      </label>
      <select
        id={`${ids}-how`}
        className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
        value={method}
        onChange={(event) => setMethod(event.target.value)}
      >
        {methods.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-ref`}>
        {r.reference}
      </label>
      <input
        id={`${ids}-ref`}
        className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
        value={reference}
        onChange={(event) => setReference(event.target.value)}
      />

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-against`}>
        {r.against}
      </label>
      <select
        id={`${ids}-against`}
        className="mt-1 min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
        value={invoiceId}
        onChange={(event) => setInvoiceId(event.target.value)}
        disabled={customerId === ''}
      >
        <option value="">{r.standalone}</option>
        {options.map((invoice) => (
          <option key={invoice.id} value={invoice.id}>
            {invoice.reference} · {formatMoney(invoice.outstanding)}
          </option>
        ))}
      </select>
      {customerId === '' ? (
        <p className="mt-1 text-[11px] opacity-60">{r.pickWhoFirst}</p>
      ) : (
        invoiceId === '' && (
          // Said out loud: nothing is billed to anyone from nowhere (§G).
          <p className="mt-1 text-[11px] opacity-60">{r.standaloneNote}</p>
        )
      )}

      <button
        type="button"
        className="mt-4 min-h-tap w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
        disabled={!canRecord}
        onClick={() => {
          const chosen = options.find((invoice) => invoice.id === invoiceId)
          onRecord({
            customerId,
            amount: money(currency, minor),
            paidAt,
            method,
            ...(reference.trim() === '' ? {} : { reference: reference.trim() }),
            ...(chosen === undefined ? {} : { invoiceId: chosen.id }),
          })
        }}
      >
        {r.record}
      </button>

      {error !== undefined && (
        <p
          className="mt-3 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  )
}
