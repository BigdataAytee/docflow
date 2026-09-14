/**
 * Home's two stats (§G).
 *
 * "Exactly two glass stat cards: Outstanding (remaining balance on issued,
 * non-cancelled invoices after effective payments and credits) and Received
 * this month (effective incoming payments in the company's current calendar
 * month). Receipts never count as more money; quotations and delivery
 * documents contribute none. Separate currency values are shown separately —
 * NGN and USD are never added together."
 *
 * Every clause in that paragraph is a way the number could be wrong, so each
 * one is a test below.
 */

import { type CurrencyCode, type Money, add, zero } from '../../domain/money/money'
import type { CreditNote, Payment } from '../../domain/payments/ledger'
import { effectivePayments, invoiceOutstanding } from '../../domain/payments/ledger'
import type { DocumentType } from '../../domain/documents/types'

export interface StatDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly total: Money
}

/** Only issued, non-void invoices are money anyone is owed (§G). */
function countsTowardsOutstanding(document: StatDocument): boolean {
  if (document.type !== 'invoice') return false
  return document.status !== 'draft' && document.status !== 'void'
}

/**
 * Outstanding, per currency. A quotation is not money owed — it has not been
 * agreed. A delivery document carries no money at all. And a receipt is
 * evidence of money already received, so counting it here would bill the
 * customer twice for one sale.
 */
export function outstandingByCurrency(
  documents: readonly StatDocument[],
  payments: readonly Payment[],
  creditNotes: readonly CreditNote[] = [],
): Map<CurrencyCode, Money> {
  const buckets = new Map<CurrencyCode, Money>()

  for (const document of documents) {
    if (!countsTowardsOutstanding(document)) continue
    const currency = document.total.currency
    const left = invoiceOutstanding(document.id, document.total, payments, creditNotes)
    buckets.set(currency, add(buckets.get(currency) ?? zero(currency), left))
  }

  return buckets
}

/** The first instant of the calendar month containing `at`, as an ISO date. */
export function monthStart(at: string): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) throw new RangeError(`Not a date: ${at}`)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/** The first instant of the following month. */
export function nextMonthStart(at: string): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) throw new RangeError(`Not a date: ${at}`)
  const year = date.getUTCMonth() === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear()
  const month = date.getUTCMonth() === 11 ? 0 : date.getUTCMonth() + 1
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

/**
 * Received this calendar month, per currency.
 *
 * Payments only — never documents. A receipt is a view of a payment (§G), so
 * summing receipts as well would double every settled sale, which is exactly
 * what §V's "issuing or resharing its receipt never increments income" rules
 * out.
 */
export function receivedThisMonth(
  payments: readonly Payment[],
  now: string,
): Map<CurrencyCode, Money> {
  const from = monthStart(now)
  const to = nextMonthStart(now)

  const buckets = new Map<CurrencyCode, Money>()
  for (const payment of effectivePayments(payments)) {
    const day = payment.paidAt.slice(0, 10)
    if (day < from || day >= to) continue
    const currency = payment.amount.currency
    buckets.set(currency, add(buckets.get(currency) ?? zero(currency), payment.amount))
  }
  return buckets
}

export interface AttentionItem {
  readonly documentId: string
  readonly kind: 'overdue' | 'in_transit'
  readonly amount?: Money
  /**
   * What the row is called, and what is worth knowing about it — the
   * reference, and a line like "Chidinma Traders · N95,000 left".
   *
   * Both optional, and neither is computed here. This function decides WHICH
   * records want attention, which is arithmetic over dates and a ledger; what
   * they are called needs the customer list and the locale, and a pure stats
   * function that reached for those would stop being testable without them.
   * The screen fills these in.
   */
  readonly reference?: string
  readonly detail?: string
}

/**
 * "Needs attention — the two or three things that want doing" (§G).
 *
 * Capped deliberately: a list of everything is a backlog, not attention.
 */
export function needsAttention(
  documents: readonly StatDocument[],
  payments: readonly Payment[],
  dueDates: ReadonlyMap<string, string>,
  today: string,
  limit = 3,
): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const document of documents) {
    if (items.length >= limit) break

    if (countsTowardsOutstanding(document)) {
      const due = dueDates.get(document.id)
      const left = invoiceOutstanding(document.id, document.total, payments)
      if (due !== undefined && due < today && left.minor > 0) {
        items.push({ documentId: document.id, kind: 'overdue', amount: left })
        continue
      }
    }

    if (document.type === 'waybill' && (document.status === 'in_transit' || document.status === 'dispatched')) {
      items.push({ documentId: document.id, kind: 'in_transit' })
    }
  }

  return items.slice(0, limit)
}
