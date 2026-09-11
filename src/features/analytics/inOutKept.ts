/**
 * In / Out / Kept (§G, §L6).
 *
 * "'Kept' = recorded money in minus recorded expenses, with a short help note
 * saying so."
 *
 * Three rules decide everything here:
 *
 *  · **In is payments, never documents.** A receipt is a view of a payment
 *    (§G), so counting receipts as income would double every settled sale.
 *    §V puts it flatly: issuing or resharing a receipt never increments income.
 *  · **Kept is subtraction, not a stored figure.** Rule #3 — balances are
 *    computed. Adding an expense changes Kept because Kept is recomputed, not
 *    because anything updates a total.
 *  · **Currencies never mix** (§G). A month with NGN income and USD expenses
 *    has two rows, and neither borrows from the other.
 */

import {
  type CurrencyCode,
  type Money,
  add,
  subtract,
  zero,
} from '../../domain/money/money'
import { effectivePayments, type Payment } from '../../domain/payments/ledger'

/** What the analytics page needs of an expense; the record itself lives in §E. */
export interface ExpenseEntry {
  readonly id: string
  readonly amount: Money
  readonly spentOn: string
}

export interface InOutKept {
  readonly currency: CurrencyCode
  readonly moneyIn: Money
  readonly moneyOut: Money
  /** In less Out. Negative when a month spent more than it took — shown as is. */
  readonly kept: Money
}

/** `from` inclusive, `to` exclusive, both ISO dates. */
export interface Period {
  readonly from: string
  readonly to: string
}

const withinPeriod = (day: string, period: Period): boolean =>
  day >= period.from && day < period.to

/**
 * The three cards, per currency.
 *
 * A currency appears if it had money in OR money out, so a month of pure
 * spending is never hidden by having earned nothing.
 */
export function inOutKept(
  payments: readonly Payment[],
  expenses: readonly ExpenseEntry[],
  period: Period,
): Map<CurrencyCode, InOutKept> {
  const incoming = new Map<CurrencyCode, Money>()
  const outgoing = new Map<CurrencyCode, Money>()

  for (const payment of effectivePayments(payments)) {
    if (!withinPeriod(payment.paidAt.slice(0, 10), period)) continue
    const currency = payment.amount.currency
    incoming.set(currency, add(incoming.get(currency) ?? zero(currency), payment.amount))
  }

  for (const expense of expenses) {
    if (!withinPeriod(expense.spentOn.slice(0, 10), period)) continue
    const currency = expense.amount.currency
    outgoing.set(currency, add(outgoing.get(currency) ?? zero(currency), expense.amount))
  }

  const currencies = [...new Set([...incoming.keys(), ...outgoing.keys()])].sort()

  const rows = new Map<CurrencyCode, InOutKept>()
  for (const currency of currencies) {
    const moneyIn = incoming.get(currency) ?? zero(currency)
    const moneyOut = outgoing.get(currency) ?? zero(currency)
    rows.set(currency, { currency, moneyIn, moneyOut, kept: subtract(moneyIn, moneyOut) })
  }
  return rows
}

/** The first of the calendar month containing `day`, as an ISO date. */
export function startOfMonth(day: string): string {
  const [year, month] = splitDay(day)
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** The first of the month `count` months before the one containing `day`. */
export function shiftMonths(day: string, count: number): string {
  const [year, month] = splitDay(day)
  const zeroBased = (year * 12 + (month - 1)) + count
  return `${Math.floor(zeroBased / 12)}-${String((zeroBased % 12) + 1).padStart(2, '0')}-01`
}

function splitDay(day: string): [number, number] {
  const match = /^(\d{4})-(\d{2})/.exec(day)
  if (match === null) throw new RangeError(`Not an ISO date: ${day}`)
  return [Number(match[1]), Number(match[2])]
}

export interface MonthlyBar {
  /** `YYYY-MM`, so a caller formats the month name through its own locale. */
  readonly month: string
  readonly moneyIn: Money
  readonly moneyOut: Money
}

/**
 * "A paired in-vs-out bar chart across six months" (§G).
 *
 * Every month in the window is present even when it is empty — a gap in a bar
 * chart reads as "no data recorded", which is a different claim from "nothing
 * came in", and only one of them is true.
 */
export function monthlyBars(
  payments: readonly Payment[],
  expenses: readonly ExpenseEntry[],
  currency: CurrencyCode,
  today: string,
  months = 6,
): MonthlyBar[] {
  const bars: MonthlyBar[] = []
  for (let back = months - 1; back >= 0; back -= 1) {
    const from = shiftMonths(today, -back)
    const to = shiftMonths(today, -back + 1)
    const row = inOutKept(payments, expenses, { from, to }).get(currency)
    bars.push({
      month: from.slice(0, 7),
      moneyIn: row?.moneyIn ?? zero(currency),
      moneyOut: row?.moneyOut ?? zero(currency),
    })
  }
  return bars
}

/**
 * The tallest bar in the window, so the chart can scale without a library and
 * without a zero-division when the whole window is empty.
 */
export function tallestBar(bars: readonly MonthlyBar[]): number {
  return bars.reduce((tallest, bar) => Math.max(tallest, bar.moneyIn.minor, bar.moneyOut.minor), 0)
}
