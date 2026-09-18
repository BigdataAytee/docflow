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
import { format } from '../../domain/locale/data/strings'
import { type Money, money } from '../../domain/money/money'
import { parseAmount } from '../../domain/money/parse'
import { minorUnitsFor } from '../../domain/locale/bank-fields'
import type { Customer } from '../../data/repositories'
import { formatMoney } from '../customers/formatMoney'
import type { SettleableInvoice } from './receiptFlow'
import { settleableInvoices } from './receiptFlow'
import { useFocusOnOpen } from '../../ui'

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
  // Opening this panel moves focus into it, and its name is announced.
  const panel = useFocusOnOpen<HTMLElement>()
  const { strings } = useCompany()
  const r = strings.newReceipt
  const ids = useId()

  const [customerId, setCustomerId] = useState('')
  const [major, setMajor] = useState('')
  const [paidAt, setPaidAt] = useState(today)
  const [method, setMethod] = useState(methods[0]?.id ?? 'cash')
  const [reference, setReference] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  /*
   * Whether the invoice list is open.
   *
   * Closed to begin with, on purpose: §G's simplicity rule is that nobody
   * picks a MODE before entering anything. The card says what is owed and
   * offers one control; the list appears when they ask for it.
   */
  const [applying, setApplying] = useState(false)

  // Through the domain parser rather than `parseFloat`: a blank must not
  // become zero money, and "5,000" must not become 5. `null` is "not an
  // amount", which is a different thing from an amount of nothing (Rule #3).
  const parsed = parseAmount(major, { scale: minorUnitsFor(currency) })
  const minor = parsed ?? 0

  // Only what this money could actually settle: the payer's own balances, in
  // the currency handed over (§G — "offers only what makes sense").
  const options = settleableInvoices(invoices, customerId, currency)

  const chosen = options.find((invoice) => invoice.id === invoiceId)
  const totalOwed = money(
    currency,
    options.reduce((sum, invoice) => sum + invoice.outstanding.minor, 0),
  )

  /*
   * Choosing an invoice fills the amount when nothing has been typed yet, so
   * paying in full costs no typing — and NEVER overwrites a figure somebody
   * has already entered, which would silently change what they said came in.
   */
  const pickInvoice = (invoice: SettleableInvoice): void => {
    setInvoiceId(invoice.id)
    setApplying(false)
    if (parsed === null) {
      /*
       * Back to MAJOR units for the field, which takes what a person types.
       * Integer arithmetic on the way out as well as in (Rule #3): the minor
       * amount is split by the currency's own scale rather than divided as a
       * float and rounded back.
       */
      const scale = minorUnitsFor(currency)
      const whole = Math.trunc(invoice.outstanding.minor / scale)
      const rest = invoice.outstanding.minor - whole * scale
      /*
       * No trailing `.00` on a whole amount. The field takes what a person
       * would type, and nobody types the zeros — offering them back makes the
       * prefill look like a calculation rather than an answer.
       */
      setMajor(
        rest === 0
          ? String(whole)
          : `${whole}.${String(rest).padStart(String(scale).length - 1, '0')}`,
      )
    }
  }

  const canRecord = minor > 0 && customerId !== ''

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="glass-solid rounded-2xl p-4 outline-none"
      aria-label={r.title}
    >
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
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
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
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-lg tabular-nums"
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
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
        value={paidAt}
        onChange={(event) => setPaidAt(event.target.value)}
      />

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-how`}>
        {r.method}
      </label>
      <select
        id={`${ids}-how`}
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
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
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
        value={reference}
        onChange={(event) => setReference(event.target.value)}
      />

      {/*
        WHAT THEY OWE, SAID OUT LOUD — the whole point of this change.

        This was a `<select>` labelled "Against" with a faint line under it: a
        control somebody had to already know about to notice, offering the one
        act that makes a receipt do more than acknowledge cash. A first-time
        owner never found it.

        It is a card now, and it only exists when there is something to say —
        no card when the customer owes nothing, and none before a customer is
        chosen. Nobody is asked to pick a MODE before they have entered
        anything (§G's simplicity rule); the card states a fact and offers one
        control.
      */}
      {customerId === '' ? (
        <p className="mt-3 text-[11px] opacity-60">{r.pickWhoFirst}</p>
      ) : options.length === 0 ? (
        <p className="mt-3 text-[11px] opacity-60">{r.standaloneNote}</p>
      ) : (
        <section
          data-owes-card
          className="mt-4 rounded-2xl border border-brand/20 bg-brand-tint p-3.5"
        >
          <p className="text-[13px] font-semibold leading-snug text-brand">
            {format(options.length === 1 ? r.owesOne : r.owesMany, {
              name: customers.find((c) => c.id === customerId)?.name ?? '',
              amount: formatMoney(totalOwed),
              count: String(options.length),
            })}
          </p>

          {!applying && chosen === undefined && (
            <button
              type="button"
              onClick={() => setApplying(true)}
              className="raised tap-scale mt-2.5 min-h-tap w-full rounded-xl bg-surface px-3 text-[13px] font-semibold text-brand"
            >
              {r.applyToInvoice}
            </button>
          )}

          {/* The chosen one, and a way to change your mind. */}
          {chosen !== undefined && !applying && (
            <button
              type="button"
              onClick={() => setApplying(true)}
              className="mt-2.5 flex min-h-tap w-full items-center justify-between gap-3 rounded-xl bg-surface px-3 text-start text-[13px] font-semibold"
            >
              <span className="min-w-0 truncate">{chosen.reference}</span>
              <span className="shrink-0 tabular-nums opacity-70">
                {formatMoney(chosen.outstanding)}
              </span>
            </button>
          )}

          {applying && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[11px] font-medium opacity-70">{r.pickInvoice}</p>
              <ul className="space-y-1.5" role="list">
                {options.map((invoice) => (
                  <li key={invoice.id}>
                    <button
                      type="button"
                      onClick={() => pickInvoice(invoice)}
                      aria-pressed={invoiceId === invoice.id}
                      className={`flex min-h-tap w-full items-center justify-between gap-3 rounded-xl px-3 text-start text-[13px] ${
                        invoiceId === invoice.id
                          ? 'bg-brand text-white'
                          : 'raised tap-scale bg-surface'
                      }`}
                    >
                      <span className="min-w-0 truncate font-semibold">{invoice.reference}</span>
                      <span className="shrink-0 tabular-nums opacity-80">
                        {format(r.owingLine, { amount: formatMoney(invoice.outstanding) })}
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceId('')
                      setApplying(false)
                    }}
                    className="min-h-tap w-full rounded-xl px-3 text-start text-[12.5px] opacity-70"
                  >
                    {r.leaveUnapplied}
                  </button>
                </li>
              </ul>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        className="raised tap-scale mt-4 min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
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
