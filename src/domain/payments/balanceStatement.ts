/**
 * What a balance invoice is FOR, arithmetically (§K, Rule #3).
 *
 * A balance invoice used to carry one line — "Balance of INV-0002", quantity
 * one, at the outstanding amount — and the comment defending that said
 * re-listing the original's items "would read as a second request for the
 * whole job rather than for what is left of it".
 *
 * That fear is real and the answer is not to hide the goods. It is to show
 * the goods AND the deductions, so the document proves it is a remainder:
 *
 *     Cement 50kg × 20 ........ ₦100,000
 *     Labour 6 hrs .............. ₦45,000
 *     Invoice total ........ ₦145,000
 *     Less: paid on 21 Sep ...... −₦50,000
 *     Balance due .......... ₦95,000
 *
 * A customer can recognise what they bought, and can see in one line that
 * ₦50,000 of it is already handled. The single-line version asked them to
 * take ₦95,000 on trust.
 *
 * THE TOTAL IS THE FROZEN ONE, NOT A RECOMPUTATION. `billed` is the
 * ORIGINAL's `totalMinor` — the figure that froze when the original was
 * issued (Rule #5) — and the balance is that minus what has been paid. The
 * items are carried across so the customer can see them, and they are NOT
 * what the arithmetic runs on: re-pricing ten lines and re-applying a tax
 * rate would be a second computation of a number that is already settled, and
 * the day the two disagree the customer holds two documents that contradict
 * each other. One of them has to be authoritative and it is the one the
 * customer already has.
 *
 * `statementAddsUp` exists so that "the items no longer sum to the frozen
 * total" is a failing test rather than a discrepancy somebody notices on
 * paper.
 */

import {
  type CurrencyCode,
  type Money,
  MoneyError,
  isNegative,
  money,
  subtract,
  sum,
  zero,
} from '../money/money'

/** One payment already received, as it prints on the statement. */
export interface Deduction {
  /** The calendar day the money arrived (§E) — never an instant. */
  readonly paidAt: string
  readonly amount: Money
}

/**
 * What is still owed: the frozen total, less everything paid.
 *
 * NEVER NEGATIVE. An overpayment is customer credit, not a debt owed the
 * other way — the same rule `invoiceOutstanding` applies, and applied the
 * same way so the two cannot disagree about a settled invoice.
 */
export function balanceDue(billed: Money, deductions: readonly Deduction[]): Money {
  for (const deduction of deductions) {
    if (deduction.amount.currency !== billed.currency) {
      throw new MoneyError(
        `A balance cannot mix ${billed.currency} with ${deduction.amount.currency} (v6 Rule #3).`,
      )
    }
  }

  const paid = sum(
    deductions.map((deduction) => deduction.amount),
    billed.currency,
  )
  const left = subtract(billed, paid)
  return isNegative(left) ? zero(billed.currency) : left
}

/**
 * Whether the carried items still account for the frozen total.
 *
 * Takes the COMPUTED total — what the carried items and the carried rates
 * come to — rather than the bare line totals, because a taxed document's
 * lines sum to its subtotal and not to the figure printed as the invoice
 * total.
 *
 * Not used to DECIDE anything: the frozen total decides, always. This is
 * asserted in tests so that a balance invoice whose visible lines contradict
 * its own stated total fails here rather than in a customer's hands.
 */
export const statementAddsUp = (billed: Money, computed: Money): boolean =>
  computed.currency === billed.currency && computed.minor === billed.minor

/**
 * The deductions a balance invoice should carry, from the ledger.
 *
 * EVERY payment against the original, in the order the money arrived, so the
 * statement reads as a history rather than a single netted figure. Five
 * instalments print as five lines; that is the point of showing them.
 *
 * Sorted by day, then by id, so two payments on the same date come out in a
 * stable order rather than whichever the store happened to return — a
 * document whose lines reorder between two renders is a document that looks
 * edited.
 */
export function deductionsFrom(
  allocations: readonly { readonly paidAt: string; readonly id: string; readonly amount: Money }[],
  currency: CurrencyCode,
): Deduction[] {
  return [...allocations]
    .filter((allocation) => allocation.amount.currency === currency)
    .sort((a, b) => (a.paidAt === b.paidAt ? a.id.localeCompare(b.id) : a.paidAt < b.paidAt ? -1 : 1))
    .map((allocation) => ({ paidAt: allocation.paidAt, amount: allocation.amount }))
}

/** The deductions as stored on the record: minor units, never a float. */
export const storedDeductions = (
  deductions: readonly Deduction[],
): { readonly paidAt: string; readonly amountMinor: number }[] =>
  deductions.map((deduction) => ({
    paidAt: deduction.paidAt,
    amountMinor: deduction.amount.minor,
  }))

/** And back again, for the page that prints them. */
export const restoreDeductions = (
  stored: readonly { readonly paidAt: string; readonly amountMinor: number }[],
  currency: CurrencyCode,
): Deduction[] =>
  stored.map((entry) => ({ paidAt: entry.paidAt, amount: money(currency, entry.amountMinor) }))
