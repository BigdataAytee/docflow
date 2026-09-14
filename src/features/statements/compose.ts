/**
 * Customer statements (§L5).
 *
 * "A period PDF of invoices against payments with a closing balance."
 *
 * A statement is a VIEW, never a record. It creates nothing, numbers nothing,
 * freezes nothing and is never issued — reprinting one twice cannot change a
 * balance or move income, because there is nothing here that writes. That is
 * deliberate: the closing balance is recomputed from the ledger every time
 * (Rule #3), so a statement printed today and one printed tomorrow agree with
 * the app rather than with each other.
 *
 * One statement covers ONE currency. §G forbids adding NGN to USD, and a
 * closing balance is exactly the line where that would happen invisibly.
 */

import {
  type CurrencyCode,
  type Money,
  add,
  subtract,
  zero,
} from '../../domain/money/money'
import { type CreditNote, type Payment, effectivePayments } from '../../domain/payments/ledger'
import type { DocumentType } from '../../domain/documents/types'
import { localDay } from '../../domain/dates/calendar'

export interface StatementDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly customerId: string
  readonly total: Money
  /** An unissued draft has none, and is not on a statement (§M). */
  readonly issueDate?: string
  readonly issuedReference: string | null
}

export type StatementRowKind = 'charge' | 'payment' | 'credit'

export interface StatementRow {
  readonly kind: StatementRowKind
  readonly date: string
  readonly reference: string
  /** Positive increases what is owed; a payment or credit reduces it. */
  readonly charged: Money
  readonly paid: Money
  /** What is owed after this row — the running balance down the page. */
  readonly balance: Money
}

export interface Statement {
  readonly customerId: string
  readonly currency: CurrencyCode
  readonly from: string
  /** Exclusive, matching every other period in the codebase. */
  readonly to: string
  readonly openingBalance: Money
  readonly rows: readonly StatementRow[]
  readonly charged: Money
  readonly paid: Money
  readonly credited: Money
  readonly closingBalance: Money
}

export interface StatementInput {
  readonly customerId: string
  readonly currency: CurrencyCode
  readonly from: string
  readonly to: string
  readonly documents: readonly StatementDocument[]
  readonly payments: readonly Payment[]
  readonly creditNotes?: readonly CreditNote[]
  /** Credit notes carry no date of their own in §E's field list. */
  readonly creditNoteDates?: ReadonlyMap<string, string>
  readonly creditNoteCustomers?: ReadonlyMap<string, string>
  readonly creditNoteReferences?: ReadonlyMap<string, string>
}

interface Movement {
  readonly kind: StatementRowKind
  readonly date: string
  readonly reference: string
  readonly amount: Money
}

/** Issued, non-void invoices are the only thing that increases what is owed. */
const billable = (document: StatementDocument): boolean =>
  document.type === 'invoice' && document.status !== 'draft' && document.status !== 'void'

export function composeStatement(input: StatementInput): Statement {
  const currency = input.currency
  const movements: Movement[] = []

  for (const document of input.documents) {
    if (document.customerId !== input.customerId) continue
    if (!billable(document)) continue
    if (document.total.currency !== currency) continue
    const day = document.issueDate?.slice(0, 10)
    if (day === undefined) continue
    movements.push({
      kind: 'charge',
      date: day,
      reference: document.issuedReference ?? document.id,
      amount: document.total,
    })
  }

  for (const payment of effectivePayments(input.payments)) {
    if (payment.customerId !== input.customerId) continue
    if (payment.amount.currency !== currency) continue
    movements.push({
      kind: 'payment',
      date: localDay(payment.paidAt),
      reference: payment.reference ?? payment.id,
      amount: payment.amount,
    })
  }

  for (const credit of input.creditNotes ?? []) {
    if (credit.amount.currency !== currency) continue
    const owner = input.creditNoteCustomers?.get(credit.id)
    if (owner !== undefined && owner !== input.customerId) continue
    // A credit with no recorded owner is only included when its invoice is on
    // this customer's book — never guessed onto a statement.
    if (owner === undefined && !belongsToCustomer(credit, input)) continue
    const day = input.creditNoteDates?.get(credit.id)
    if (day === undefined) continue
    movements.push({
      kind: 'credit',
      date: day,
      reference: input.creditNoteReferences?.get(credit.id) ?? credit.id,
      amount: credit.amount,
    })
  }

  // Charges before settlements on the same day: a customer who paid an invoice
  // the day it was raised should read as billed-then-paid, not as credit first.
  const order: Record<StatementRowKind, number> = { charge: 0, credit: 1, payment: 2 }
  movements.sort(
    (a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.reference.localeCompare(b.reference),
  )

  let opening = zero(currency)
  for (const movement of movements) {
    if (movement.date >= input.from) break
    opening = movement.kind === 'charge' ? add(opening, movement.amount) : subtract(opening, movement.amount)
  }

  const rows: StatementRow[] = []
  let balance = opening
  let charged = zero(currency)
  let paid = zero(currency)
  let credited = zero(currency)

  for (const movement of movements) {
    if (movement.date < input.from || movement.date >= input.to) continue

    if (movement.kind === 'charge') {
      balance = add(balance, movement.amount)
      charged = add(charged, movement.amount)
      rows.push({
        kind: 'charge',
        date: movement.date,
        reference: movement.reference,
        charged: movement.amount,
        paid: zero(currency),
        balance,
      })
      continue
    }

    balance = subtract(balance, movement.amount)
    if (movement.kind === 'payment') paid = add(paid, movement.amount)
    else credited = add(credited, movement.amount)
    rows.push({
      kind: movement.kind,
      date: movement.date,
      reference: movement.reference,
      charged: zero(currency),
      paid: movement.amount,
      balance,
    })
  }

  return {
    customerId: input.customerId,
    currency,
    from: input.from,
    to: input.to,
    openingBalance: opening,
    rows,
    charged,
    paid,
    credited,
    closingBalance: balance,
  }
}

function belongsToCustomer(credit: CreditNote, input: StatementInput): boolean {
  const invoice = input.documents.find((document) => document.id === credit.invoiceId)
  return invoice !== undefined && invoice.customerId === input.customerId
}

/** The currencies this customer has any history in, so the UI offers those. */
export function statementCurrencies(
  customerId: string,
  documents: readonly StatementDocument[],
  payments: readonly Payment[],
): CurrencyCode[] {
  const currencies = new Set<CurrencyCode>()
  for (const document of documents) {
    if (document.customerId === customerId && billable(document)) currencies.add(document.total.currency)
  }
  for (const payment of effectivePayments(payments)) {
    if (payment.customerId === customerId) currencies.add(payment.amount.currency)
  }
  return [...currencies].sort()
}
