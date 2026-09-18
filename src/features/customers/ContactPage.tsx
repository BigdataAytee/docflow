/**
 * The contact page (§G — Customers).
 *
 * "Header with labels (Wholesale, Retail, VIP, Pays late) and `+ label`; Chat /
 * Call / Statement row; Balance (billed all time, paid, owing now, progress,
 * and a line like 'Pays on average 9 days late. Consider part payment up
 * front.'); History of every document; Notes, private, never printed."
 *
 * Four things it is careful about:
 *
 *  · **Currencies never merge.** One balance block per currency (§G), because
 *    a single "owing" figure across NGN and USD is a number that means nothing.
 *  · **The pays-late line is silent below its sample floor.** `paymentBehaviour`
 *    returns null under two settled invoices, and one data point dressed as a
 *    pattern would have the owner asking a good customer for money up front.
 *  · **Chat and Call are absent without a phone number**, not disabled. §N's
 *    rule about unavailable capabilities applies to a dead chip too.
 *  · **The note never prints.** It is not on the document model at all, so
 *    there is no path from here onto a page a customer sees.
 *
 * Nothing here computes money. Balances come from `customerBalances`, the
 * behaviour line from `paymentBehaviour`; both are property-tested.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import type { Customer } from '../../data/repositories'
import { EmptyState, PageHeader, StatusBadge } from '../../ui'
import {
  type BilledInvoice,
  type CurrencyBalance,
  customerBalances,
  paymentBehaviour,
} from './balance'
import { formatMoney } from './formatMoney'
import { MAX_LABEL_LENGTH, addLabel, removeLabel } from './labels'
import type { CreditNote, Payment } from '../../domain/payments/ledger'

/** One row of §G's "History of every document". */
export interface HistoryRow {
  readonly id: string
  readonly reference: string
  readonly status: string
  readonly statusLabel: string
  readonly date?: string
  /** Absent on a delivery document, which carries no money (§G, §I). */
  readonly amount?: { currency: string; minor: number }
}

export interface ContactPageProps {
  readonly customer: Customer
  readonly invoices: readonly BilledInvoice[]
  readonly payments: readonly Payment[]
  /** Credits lower what is owed without moving income (§E, Rule #5). */
  readonly creditNotes?: readonly CreditNote[]
  readonly history: readonly HistoryRow[]
  readonly onLabels: (labels: readonly string[]) => void
  readonly onNote: (note: string) => void
  readonly onOpenDocument: (id: string) => void
  readonly onStatement: () => void
  readonly onBack: () => void
}

export function ContactPage({
  customer,
  invoices,
  payments,
  creditNotes = [],
  history,
  onLabels,
  onNote,
  onOpenDocument,
  onStatement,
  onBack,
}: ContactPageProps) {
  const { strings } = useCompany()

  const [newLabel, setNewLabel] = useState('')
  const [note, setNote] = useState(customer.privateNote ?? '')

  const balances = customerBalances(customer.id, invoices, payments, creditNotes)
  const behaviour = paymentBehaviour(customer.id, invoices, payments)

  const digits = customer.phone?.replace(/\D/g, '') ?? ''
  const canReach = digits !== ''

  /*
   * NO NAV BELOW THIS PAGE, so no room reserved for one.
   *
   * `pb-28` was 7rem of empty space held open for a floating pill that this
   * screen no longer draws — a blank band under the last control, which is the
   * gap that makes a removed element look like a bug. What stays is the gesture
   * area, which is a property of the DEVICE and does not care which route is on
   * screen.
   */
  return (
    <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <PageHeader
        title={customer.name}
        {...(customer.address === undefined ? {} : { subtitle: customer.address })}
        leading={
          <button
            type="button"
            onClick={onBack}
            aria-label={strings.contact.back}
            className="min-h-tap min-w-tap text-xl leading-none"
          >
            ‹
          </button>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        <section className="glass rounded-2xl p-4" aria-label={strings.customers.labels}>
          <h2 className="text-sm font-semibold">{strings.customers.labels}</h2>
          {customer.labels.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {customer.labels.map((label) => (
                <li key={label}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand">
                    {label}
                    <button
                      type="button"
                      aria-label={format(strings.contact.removeLabel, { label })}
                      className="text-sm leading-none"
                      onClick={() => onLabels(removeLabel(customer.labels, label))}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const wanted = newLabel.trim()
              if (wanted === '') return
              try {
                onLabels(addLabel(customer.labels, wanted))
                setNewLabel('')
              } catch {
                // `cleanLabel` refuses an empty or over-long label; the field
                // keeps what was typed so nothing the owner wrote is lost.
              }
            }}
          >
            <input
              className="min-h-tap min-w-0 flex-1 rounded-xl border border-edge/10 bg-surface px-3 text-sm"
              placeholder={strings.customers.addLabel}
              aria-label={strings.contact.newLabel}
              maxLength={MAX_LABEL_LENGTH}
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
            />
            <button
              type="submit"
              className="raised tap-scale min-h-tap rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white"
            >
              {strings.contact.saveLabel}
            </button>
          </form>
        </section>

        {/*
          No aria-label. This row holds Chat, Call and Statement, and naming
          the row after one of its three buttons made the landmark announce
          as "Statement" — the screen-reader sweep's landmark-name-collides
          rule. The buttons name themselves; the row needs no name of its own.
        */}
        <section className="flex gap-2">
          {canReach && (
            <>
              {/* Real links, not stubs: both work in a browser today and hand
                  off to the installed apps on a phone (§N — never a dead control). */}
              <a
                href={`https://wa.me/${digits}`}
                className="flex min-h-tap flex-1 items-center justify-center rounded-2xl bg-status-good-tint text-sm font-semibold text-status-good"
              >
                {strings.contact.chat}
              </a>
              <a
                href={`tel:${customer.phone ?? ''}`}
                className="glass flex min-h-tap flex-1 items-center justify-center rounded-2xl text-sm font-semibold"
              >
                {strings.contact.call}
              </a>
            </>
          )}
          <button
            type="button"
            onClick={onStatement}
            className="glass min-h-tap flex-1 rounded-2xl text-sm font-semibold"
          >
            {strings.contact.statement}
          </button>
        </section>
        {!canReach && <p className="px-1 text-xs opacity-70">{strings.contact.noPhone}</p>}

        <section className="glass rounded-2xl p-4" aria-label={strings.contact.balance}>
          <h2 className="text-sm font-semibold">{strings.contact.balance}</h2>

          {balances.length === 0 ? (
            <p className="mt-2 text-sm opacity-70">{strings.customers.settled}</p>
          ) : (
            balances.map((balance) => <BalanceBlock key={balance.currency} balance={balance} />)
          )}

          {behaviour !== null && (
            <p className="mt-3 text-xs opacity-80">
              {behaviour.averageDaysLate > 0
                ? `${format(strings.customers.paysLate, { days: behaviour.averageDaysLate })} ${strings.customers.considerPartPayment}`
                : behaviour.averageDaysLate < 0
                  ? format(strings.customers.paysEarly, { days: -behaviour.averageDaysLate })
                  : strings.customers.paysOnTime}
            </p>
          )}
        </section>

        <section className="glass rounded-2xl p-4" aria-label={strings.contact.history}>
          <h2 className="text-sm font-semibold">{strings.contact.history}</h2>
          {history.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title={strings.contact.noHistory}
                body={strings.contact.noHistoryBody}
              />
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {history.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onOpenDocument(row.id)}
                    // `flex-wrap`: at 200% text the reference, the badge and
                    // the amount cannot share a line on a phone, and the
                    // amount was dragging the page sideways.
                    className="flex min-h-tap w-full flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2 text-start"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold">{row.reference}</span>
                      {row.date !== undefined && (
                        <span className="block text-xs tabular-nums opacity-60">{row.date}</span>
                      )}
                    </span>
                    <StatusBadge status={row.status} label={row.statusLabel} />
                    {row.amount !== undefined && (
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatMoney(row.amount)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* No aria-label on the section: the heading below already names it,
            and repeating the word would give the textarea a twin. */}
        <section className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold">{strings.contact.notes}</h2>
          <p className="mt-0.5 text-xs opacity-70">{strings.contact.notesHint}</p>
          <textarea
            className="mt-2 min-h-[88px] w-full rounded-xl border border-edge/10 bg-surface p-3 text-sm"
            placeholder={strings.contact.notesPlaceholder}
            aria-label={strings.contact.notes}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (note !== (customer.privateNote ?? '')) onNote(note)
            }}
          />
        </section>
      </div>
    </div>
  )
}

/** §G's four figures, per currency, with the progress bar under them. */
function BalanceBlock({ balance }: { balance: CurrencyBalance }) {
  const { strings } = useCompany()
  const percent = Math.max(0, Math.min(100, balance.progress * 100))

  // `role="group"` so the currency label is actually announced: aria-label on
  // a bare div is prohibited by ARIA and silently dropped, which left this
  // block — one of several, one per currency — with no name at all.
  return (
    <div className="mt-3" role="group" aria-label={balance.currency}>
      <dl className="space-y-1 text-sm">
        <Row label={strings.customers.billedAllTime} value={formatMoney(balance.billed)} />
        <Row label={strings.customers.paid} value={formatMoney(balance.paid)} />
        {balance.credited.minor !== 0 && (
          <Row label={strings.statements.credited} value={formatMoney(balance.credited)} />
        )}
        <Row label={strings.customers.owingNow} value={formatMoney(balance.owing)} strong />
      </dl>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.06]"
        role="progressbar"
        aria-label={`${strings.customers.paid} ${balance.currency}`}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-status-good" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="opacity-70">{label}</dt>
      <dd className={`tabular-nums ${strong === true ? 'font-bold' : 'font-medium'}`}>{value}</dd>
    </div>
  )
}
