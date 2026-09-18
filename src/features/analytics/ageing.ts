/**
 * "How late the money is" — ageing buckets (§G).
 *
 * "Ageing buckets (not due, 1–30, 31–60, 60+) with a line naming the worst
 * bucket."
 *
 * The buckets are disjoint by construction. §G's last label reads "60+" while
 * the one before it ends at 60, so the boundary is read as strictly-more-than-
 * sixty: an invoice 60 days late lands in 31–60 and is counted exactly once.
 * Double-counting here would overstate how bad the book is, which is the one
 * direction an ageing chart must never be wrong in.
 *
 * Only issued, non-void invoices with something still outstanding appear.
 * Quotations are not money owed, delivery documents carry no money, and a
 * receipt is evidence of money already in.
 */

import { type CurrencyCode, type Money, add, isPositive, zero } from '../../domain/money/money'
import type { CreditNote, Payment } from '../../domain/payments/ledger'
import { invoiceOutstanding } from '../../domain/payments/ledger'
import type { DocumentType } from '../../domain/documents/types'

export const AGEING_BUCKETS = ['not_due', 'd1_30', 'd31_60', 'd60_plus'] as const
export type AgeingBucket = (typeof AGEING_BUCKETS)[number]

export interface AgeingDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly total: Money
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

export interface Ageing {
  readonly currency: CurrencyCode
  readonly buckets: Readonly<Record<AgeingBucket, Money>>
  readonly total: Money
  /**
   * The overdue bucket holding the most money, or null when nothing is late.
   * "Not due" is never the worst bucket — money that is not yet late is not a
   * problem to name.
   */
  readonly worst: AgeingBucket | null
}

const DAY_MS = 86_400_000

/** Whole days `day` falls before `today`. Negative when it is still ahead. */
export function daysOverdue(dueDate: string, today: string): number {
  const due = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`)
  const now = Date.parse(`${today.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(due) || Number.isNaN(now)) {
    throw new RangeError(`Not an ISO date: ${dueDate} / ${today}`)
  }
  return Math.round((now - due) / DAY_MS)
}

export function bucketFor(dueDate: string | undefined, today: string): AgeingBucket {
  // No due date is not lateness — nothing was promised, so nothing is broken.
  if (dueDate === undefined) return 'not_due'
  const late = daysOverdue(dueDate, today)
  if (late <= 0) return 'not_due'
  if (late <= 30) return 'd1_30'
  if (late <= 60) return 'd31_60'
  return 'd60_plus'
}

function emptyBuckets(currency: CurrencyCode): Record<AgeingBucket, Money> {
  return {
    not_due: zero(currency),
    d1_30: zero(currency),
    d31_60: zero(currency),
    d60_plus: zero(currency),
  }
}

/*
 * A SUPERSEDED BALANCE IS BILLED SOMEWHERE ELSE, so it is not counted here.
 *
 * The debt has not gone: a live follow-up is asking for it, and that document
 * counts in this same sum. Counting both is how ₦95,000 owed came to show as
 * ₦190,000, and how the original still read unpaid after the follow-up was
 * settled. One debt, one place, at every stage (§K).
 */
const countsAsOwed = (document: AgeingDocument): boolean =>
  document.type === 'invoice' &&
  document.balanceSuperseded !== true &&
  document.status !== 'draft' &&
  document.status !== 'void'

/** Ageing per currency — §G forbids adding NGN to USD to make one chart. */
export function ageingByCurrency(
  documents: readonly AgeingDocument[],
  payments: readonly Payment[],
  today: string,
  creditNotes: readonly CreditNote[] = [],
): Map<CurrencyCode, Ageing> {
  const accumulating = new Map<CurrencyCode, Record<AgeingBucket, Money>>()

  for (const document of documents) {
    if (!countsAsOwed(document)) continue
    const left = invoiceOutstanding(document.id, document.total, payments, creditNotes)
    if (!isPositive(left)) continue

    const currency = document.total.currency
    const buckets = accumulating.get(currency) ?? emptyBuckets(currency)
    const bucket = bucketFor(document.dueDate, today)
    buckets[bucket] = add(buckets[bucket], left)
    accumulating.set(currency, buckets)
  }

  const result = new Map<CurrencyCode, Ageing>()
  for (const [currency, buckets] of accumulating) {
    let total = zero(currency)
    for (const bucket of AGEING_BUCKETS) total = add(total, buckets[bucket])

    let worst: AgeingBucket | null = null
    for (const bucket of AGEING_BUCKETS) {
      if (bucket === 'not_due') continue
      if (!isPositive(buckets[bucket])) continue
      if (worst === null || buckets[bucket].minor > buckets[worst].minor) worst = bucket
    }

    result.set(currency, { currency, buckets, total, worst })
  }
  return result
}
