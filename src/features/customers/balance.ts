/**
 * Customer balances and payment behaviour (§G — Customers).
 *
 * "Billed all time, paid, owing now, progress, and a line like 'Pays on
 * average 9 days late.'"
 *
 * Rule #4 applies in full: nothing here infers money. Everything is computed
 * from issued documents and effective ledger entries at read time (§C), and
 * currencies are kept apart (§G) — a customer with NGN and USD invoices has
 * two balances, never one meaningless sum.
 */

import {
  type CurrencyCode,
  type Money,
  add,
  isPositive,
  money,
  subtract,
  zero,
} from '../../domain/money/money'
import {
  type CreditNote,
  type Payment,
  effectivePayments,
  invoiceOutstanding,
} from '../../domain/payments/ledger'

/** The subset of an invoice this module needs. */
export interface BilledInvoice {
  readonly id: string
  readonly customerId: string
  readonly status: string
  readonly total: Money
  readonly issueDate: string
  readonly dueDate?: string
  /**
   * Whether a LIVE follow-up is billing this invoice's balance (§K).
   *
   * Derived, never stored — `supersededBalanceIds` works it out from the
   * documents at read time. When it is true this invoice is not the one
   * asking for the money any more, so it contributes nothing to what is owed;
   * the follow-up contributes instead, and the debt is counted exactly once.
   *
   * Without it both documents billed the same money: ₦95,000 owed showed as
   * ₦190,000, and the original still read unpaid after the follow-up was
   * settled.
   */
  readonly balanceSuperseded?: boolean
}

export interface CurrencyBalance {
  readonly currency: CurrencyCode
  /** Every issued, non-void invoice, all time. */
  readonly billed: Money
  /** Effective allocations against those invoices. */
  readonly paid: Money
  /** Credit notes reduce what is owed without moving income. */
  readonly credited: Money
  /** billed − paid − credited, floored at zero: overpayment is credit. */
  readonly owing: Money
  /** 0…1 for the progress bar. 1 when nothing is billed — nothing is owed. */
  readonly progress: number
}

/** A void invoice was never really billed; it must not inflate "billed". */
/*
 * A SUPERSEDED BALANCE IS BILLED SOMEWHERE ELSE, so it is not counted here.
 *
 * The debt has not gone: a live follow-up is asking for it, and that document
 * counts in this same sum. Counting both is how ₦95,000 owed came to show as
 * ₦190,000, and how the original still read unpaid after the follow-up was
 * settled. One debt, one place, at every stage (§K).
 */
const counts = (invoice: BilledInvoice): boolean =>
  invoice.balanceSuperseded !== true &&
  invoice.status !== 'draft' &&
  invoice.status !== 'void'

export function customerBalances(
  customerId: string,
  invoices: readonly BilledInvoice[],
  payments: readonly Payment[],
  creditNotes: readonly CreditNote[] = [],
): CurrencyBalance[] {
  const mine = invoices.filter((i) => i.customerId === customerId && counts(i))
  const byCurrency = new Map<CurrencyCode, BilledInvoice[]>()
  for (const invoice of mine) {
    const bucket = byCurrency.get(invoice.total.currency) ?? []
    bucket.push(invoice)
    byCurrency.set(invoice.total.currency, bucket)
  }

  const balances: CurrencyBalance[] = []
  for (const [currency, group] of byCurrency) {
    let billed = zero(currency)
    let owing = zero(currency)
    let credited = zero(currency)

    for (const invoice of group) {
      billed = add(billed, invoice.total)
      owing = add(owing, invoiceOutstanding(invoice.id, invoice.total, payments, creditNotes))
      for (const note of creditNotes) {
        if (note.invoiceId === invoice.id && note.amount.currency === currency) {
          credited = add(credited, note.amount)
        }
      }
    }

    // Paid is what the balance implies, not a second independent sum — so the
    // three figures on screen can never disagree with each other.
    const paid = subtract(subtract(billed, owing), credited)

    balances.push({
      currency,
      billed,
      paid,
      credited,
      owing,
      progress: billed.minor === 0 ? 1 : (billed.minor - owing.minor) / billed.minor,
    })
  }

  return balances.sort((a, b) => a.currency.localeCompare(b.currency))
}

/** True when this customer owes anything at all, in any currency. */
export const hasOutstanding = (balances: readonly CurrencyBalance[]): boolean =>
  balances.some((b) => isPositive(b.owing))

export interface PaymentBehaviour {
  /** Mean days between due date and settlement. Negative means early. */
  readonly averageDaysLate: number
  /** How many settled invoices the average rests on. */
  readonly sampleSize: number
}

const DAY = 86_400_000

/**
 * How late this customer actually pays (§G).
 *
 * Only settled invoices with a due date count, and only where a payment is
 * recorded — an unpaid invoice is not evidence of lateness, it is evidence of
 * nothing yet. Returns null below the sample floor rather than dressing up one
 * data point as a pattern.
 */
export function paymentBehaviour(
  customerId: string,
  invoices: readonly BilledInvoice[],
  payments: readonly Payment[],
  minimumSample = 2,
): PaymentBehaviour | null {
  const settled = effectivePayments(payments)
  const deltas: number[] = []

  for (const invoice of invoices) {
    if (invoice.customerId !== customerId || !counts(invoice)) continue
    if (invoice.dueDate === undefined) continue
    if (isPositive(invoiceOutstanding(invoice.id, invoice.total, payments))) continue

    // The settling payment is the last one allocated to this invoice.
    const allocatedAt = settled
      .filter((p) => p.allocations.some((a) => a.invoiceId === invoice.id))
      .map((p) => Date.parse(p.paidAt))
      .filter((t) => !Number.isNaN(t))
    if (allocatedAt.length === 0) continue

    const due = Date.parse(invoice.dueDate)
    if (Number.isNaN(due)) continue

    deltas.push((Math.max(...allocatedAt) - due) / DAY)
  }

  if (deltas.length < minimumSample) return null
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
  return { averageDaysLate: Math.round(mean), sampleSize: deltas.length }
}

/** Total billed across currencies is deliberately absent — see §G. */
export const totalAcrossCurrencies = (): never => {
  throw new Error('Currencies are never added together (v6 §G). Show each balance separately.')
}

export const emptyBalance = (currency: CurrencyCode): CurrencyBalance => ({
  currency,
  billed: zero(currency),
  paid: zero(currency),
  credited: zero(currency),
  owing: money(currency, 0),
  progress: 1,
})
