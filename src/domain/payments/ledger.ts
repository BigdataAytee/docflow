/**
 * The payments ledger. v6 Rule #4 — payments are ledger records, receipts are
 * views of payments, balances are computed.
 *
 * Nothing here flips a flag. "Mark paid" in the UI opens a prefilled payment
 * confirmation (§G) and lands as a record in this ledger; there is no other way
 * for money to move. Amendments are reversal + replacement, never an edit (§E).
 */

import {
  type CurrencyCode,
  type Money,
  CurrencyMismatchError,
  MoneyError,
  add,
  compare,
  isNegative,
  isZero,
  money,
  subtract,
  sum,
  zero,
} from '../money/money'

export type PaymentSource = 'manual' | 'provider'

export interface PaymentAllocation {
  readonly id: string
  readonly paymentId: string
  readonly invoiceId: string
  readonly amount: Money
}

export interface Payment {
  readonly id: string
  readonly customerId: string
  readonly amount: Money
  readonly paidAt: string
  readonly method: string
  readonly source: PaymentSource
  /** Set on a provider payment; the idempotency handle for replayed events. */
  readonly externalEventId?: string
  /** Set when this record reverses another. The pair nets to zero. */
  readonly reversalOfId?: string
  readonly allocations: readonly PaymentAllocation[]
}

export interface CreditNote {
  readonly id: string
  readonly invoiceId: string
  readonly amount: Money
}

export class LedgerError extends MoneyError {}

/**
 * The payments that still count. A reversal cancels its target: both the
 * reversal record and the payment it reverses drop out, so a reversal followed
 * by a replacement records the corrected amount exactly once (§E, §Q).
 */
export function effectivePayments(payments: readonly Payment[]): Payment[] {
  const reversed = new Set<string>()
  for (const p of payments) {
    if (p.reversalOfId !== undefined) reversed.add(p.reversalOfId)
  }
  return payments.filter((p) => p.reversalOfId === undefined && !reversed.has(p.id))
}

/**
 * Collapse a stream of payment events to the ledger. Replaying an event — a
 * retried upload, a duplicated provider webhook, an out-of-order delivery —
 * changes nothing (§M, §U).
 */
export function applyPaymentEvents(events: readonly Payment[]): Payment[] {
  const byKey = new Map<string, Payment>()
  for (const event of events) {
    const key = event.externalEventId ?? event.id
    if (!byKey.has(key)) byKey.set(key, event)
  }
  return [...byKey.values()]
}

/** Validate a payment and its allocations before it is committed. */
export function validatePayment(
  payment: Payment,
  invoiceOutstanding: ReadonlyMap<string, Money>,
): void {
  if (isNegative(payment.amount)) {
    throw new LedgerError('A payment amount cannot be negative — reverse it instead (v6 §E).')
  }
  if (isZero(payment.amount)) {
    throw new LedgerError('A payment of zero records nothing.')
  }

  let allocated = zero(payment.amount.currency)
  for (const allocation of payment.allocations) {
    if (allocation.amount.currency !== payment.amount.currency) {
      throw new CurrencyMismatchError(allocation.amount.currency, payment.amount.currency)
    }
    if (isNegative(allocation.amount)) {
      throw new LedgerError('An allocation cannot be negative.')
    }
    const outstanding = invoiceOutstanding.get(allocation.invoiceId)
    if (outstanding === undefined) {
      throw new LedgerError(
        `Cannot allocate to unknown invoice ${allocation.invoiceId}.`,
      )
    }
    if (outstanding.currency !== allocation.amount.currency) {
      throw new CurrencyMismatchError(allocation.amount.currency, outstanding.currency)
    }
    if (compare(allocation.amount, outstanding) > 0) {
      throw new LedgerError(
        `Allocation of ${allocation.amount.minor} exceeds the ${outstanding.minor} outstanding on invoice ${allocation.invoiceId}. Handle the excess as explicit customer credit (v6 §K).`,
      )
    }
    allocated = add(allocated, allocation.amount)
  }

  if (compare(allocated, payment.amount) > 0) {
    throw new LedgerError(
      `Allocations of ${allocated.minor} exceed the payment of ${payment.amount.minor} (v6 §K).`,
    )
  }
}

/** The part of a payment not yet attached to an invoice — customer credit. */
export function unallocated(payment: Payment): Money {
  const allocated = sum(
    payment.allocations.map((a) => a.amount),
    payment.amount.currency,
  )
  return subtract(payment.amount, allocated)
}

/** What has effectively been paid against one invoice, in its own currency. */
export function paidAgainstInvoice(
  invoiceId: string,
  currency: CurrencyCode,
  payments: readonly Payment[],
): Money {
  const amounts = effectivePayments(payments)
    .flatMap((p) => p.allocations)
    .filter((a) => a.invoiceId === invoiceId && a.amount.currency === currency)
    .map((a) => a.amount)
  return sum(amounts, currency)
}

/**
 * What is still owed on an issued invoice: total, less effective allocations,
 * less credit notes. Computed at read time, never stored as truth (§C).
 */
export function invoiceOutstanding(
  invoiceId: string,
  invoiceTotal: Money,
  payments: readonly Payment[],
  creditNotes: readonly CreditNote[] = [],
): Money {
  const paid = paidAgainstInvoice(invoiceId, invoiceTotal.currency, payments)
  const credited = sum(
    creditNotes.filter((c) => c.invoiceId === invoiceId).map((c) => c.amount),
    invoiceTotal.currency,
  )
  const remaining = subtract(subtract(invoiceTotal, paid), credited)
  // Overpayment is customer credit, not a negative balance on the invoice.
  return isNegative(remaining) ? zero(invoiceTotal.currency) : remaining
}

/**
 * Incoming money in a period, split by currency and never merged (§G).
 * A receipt is a view of a payment, so receipts are not summed here — only
 * payments are. Issuing or resharing a receipt cannot increment income (§V).
 */
export function receivedByCurrency(
  payments: readonly Payment[],
  from: string,
  to: string,
): Map<CurrencyCode, Money> {
  const buckets = new Map<CurrencyCode, Money>()
  for (const payment of effectivePayments(payments)) {
    if (payment.paidAt < from || payment.paidAt >= to) continue
    const current = buckets.get(payment.amount.currency) ?? zero(payment.amount.currency)
    buckets.set(payment.amount.currency, add(current, payment.amount))
  }
  return buckets
}

/** Build the reversal record for a payment. Same amount, opposite effect. */
export function reversalOf(payment: Payment, id: string, at: string): Payment {
  if (payment.reversalOfId !== undefined) {
    throw new LedgerError('A reversal cannot itself be reversed — record a replacement instead.')
  }
  return {
    id,
    customerId: payment.customerId,
    amount: money(payment.amount.currency, payment.amount.minor),
    paidAt: at,
    method: payment.method,
    source: payment.source,
    reversalOfId: payment.id,
    allocations: [],
  }
}
