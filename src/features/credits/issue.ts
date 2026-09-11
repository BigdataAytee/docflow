/**
 * Credit notes (§E, Rule #5).
 *
 * "Issued documents are immutable. Corrections are void/credit/reissue."
 *
 * A credit note is the middle one: the invoice the customer already holds is
 * never touched, and a separate record says part of it is no longer owed. That
 * is the only honest way to correct an overcharge on a document somebody has
 * already been handed.
 *
 * Two things it deliberately cannot do:
 *
 *  · **It never moves income.** Money in is payments (§G, §V). A credit note
 *    reduces what is OWED. There is no path from a credit note into
 *    `receivedByCurrency` or `inOutKept`, and the tests hold that shut — if
 *    crediting an invoice reduced recorded income, a business would be able to
 *    erase a sale it had already banked.
 *  · **It never exceeds the invoice.** Credits totalling more than the
 *    document would make the invoice worth less than nothing, which is a
 *    refund, and a refund is money going out — an expense or a payment
 *    reversal, recorded as such.
 */

import { type Money, add, compare, isPositive, subtract, sum, zero } from '../../domain/money/money'
import { CurrencyMismatchError } from '../../domain/money/money'
import type { CreditNote } from '../../domain/payments/ledger'
import { buildReference } from '../documents/reference'

export class CreditNoteError extends Error {}

/** §E: id, company_id, invoice_id, reference, amount_minor, reason, issued_at. */
export interface CreditNoteRecord extends CreditNote {
  readonly companyId: string
  /** Frozen at issue, like a document's (§M). */
  readonly reference: string
  readonly reason: string
  readonly issuedAt: string
  /** §E's "immutable invoice snapshot reference" — what was credited, as it was. */
  readonly invoiceReference: string
  readonly invoiceTotal: Money
}

export interface IssueCreditNoteInput {
  readonly id: string
  readonly companyId: string
  readonly invoiceId: string
  readonly invoiceStatus: string
  readonly invoiceReference: string | null
  readonly invoiceTotal: Money
  readonly amount: Money
  readonly reason: string
  readonly issuedAt: string
  readonly existing?: readonly CreditNote[]
  /** Numbering, exactly as a document's (§M). */
  readonly prefix: string
  readonly sequence: number
  readonly fromReservedBlock: boolean
  readonly deviceId: string
}

/** What has already been credited against one invoice. */
export function creditedAgainst(
  invoiceId: string,
  currency: string,
  creditNotes: readonly CreditNote[],
): Money {
  return sum(
    creditNotes.filter((note) => note.invoiceId === invoiceId).map((note) => note.amount),
    currency,
  )
}

/** The most that can still be credited — the invoice, less what already was. */
export function creditableRemaining(
  invoiceId: string,
  invoiceTotal: Money,
  creditNotes: readonly CreditNote[],
): Money {
  return subtract(invoiceTotal, creditedAgainst(invoiceId, invoiceTotal.currency, creditNotes))
}

export function issueCreditNote(input: IssueCreditNoteInput): CreditNoteRecord {
  if (input.invoiceStatus === 'draft' || input.invoiceReference === null) {
    throw new CreditNoteError(
      'A draft has not been handed to anyone, so there is nothing to correct — edit it instead (Rule #5).',
    )
  }
  if (input.invoiceStatus === 'void') {
    throw new CreditNoteError('A voided document is already cancelled in full.')
  }
  if (!isPositive(input.amount)) {
    throw new CreditNoteError('A credit must be for more than nothing.')
  }
  if (input.amount.currency !== input.invoiceTotal.currency) {
    throw new CurrencyMismatchError(input.amount.currency, input.invoiceTotal.currency)
  }

  const remaining = creditableRemaining(input.invoiceId, input.invoiceTotal, input.existing ?? [])
  if (compare(input.amount, remaining) > 0) {
    throw new CreditNoteError(
      `Only ${remaining.minor} of this document is still creditable. Money going back to the customer is a refund, recorded as one.`,
    )
  }

  const reason = input.reason.trim()
  if (reason === '') {
    throw new CreditNoteError('Say why — a credit with no reason is unexplainable a year later.')
  }

  return Object.freeze({
    id: input.id,
    companyId: input.companyId,
    invoiceId: input.invoiceId,
    amount: input.amount,
    reference: buildReference({
      prefix: input.prefix,
      sequence: input.sequence,
      fromReservedBlock: input.fromReservedBlock,
      deviceId: input.deviceId,
    }),
    reason,
    issuedAt: input.issuedAt,
    invoiceReference: input.invoiceReference,
    invoiceTotal: input.invoiceTotal,
  })
}

/**
 * The total credited across a set of notes, per currency — for a statement
 * footer or an analytics line. Never added to, or subtracted from, income.
 */
export function creditedByCurrency(creditNotes: readonly CreditNote[]): Map<string, Money> {
  const buckets = new Map<string, Money>()
  for (const note of creditNotes) {
    const currency = note.amount.currency
    buckets.set(currency, add(buckets.get(currency) ?? zero(currency), note.amount))
  }
  return buckets
}
