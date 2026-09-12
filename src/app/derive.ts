/**
 * Turning stored records into what the screens ask for (§C).
 *
 * Every function here is a READ. Derived states — paid, part paid, overdue,
 * out of date — are computed from the ledger at the moment of display and
 * never stored as truth (Rule #3), so this file is where "status" stops
 * meaning the stored column and starts meaning what the owner sees.
 *
 * A draft or a cancelled document keeps its stored status: there is nothing to
 * derive about money for a document that was never issued or has been undone.
 */

import type { DocumentRecord, Customer, Payment } from '../data/repositories'
import type { DocumentType } from '../domain/documents/types'
import { deriveInvoiceState, deriveQuotationState } from '../domain/documents/lifecycle'
import { type CurrencyCode, type Money, money } from '../domain/money/money'
import { type CreditNote, invoiceOutstanding } from '../domain/payments/ledger'
import type { StatDocument } from '../features/home/stats'
import type { AgeingDocument } from '../features/analytics/ageing'
import type { SoldDocument } from '../features/analytics/topItems'
import type { StatementDocument } from '../features/statements/compose'
import type { BilledInvoice } from '../features/customers/balance'
import type { ListRow } from '../features/documents/DocumentList'
import { revisionNumberOf, supersededBy } from '../features/documents/revision'

export const totalOf = (document: DocumentRecord): Money =>
  money(document.currency, document.totalMinor)

export const statDocuments = (documents: readonly DocumentRecord[]): StatDocument[] =>
  documents.map((document) => ({
    id: document.id,
    type: document.type,
    status: document.status,
    total: totalOf(document),
  }))

export const ageingDocuments = (documents: readonly DocumentRecord[]): AgeingDocument[] =>
  documents.map((document) => ({
    id: document.id,
    type: document.type,
    status: document.status,
    total: totalOf(document),
    ...(document.dueDate === undefined ? {} : { dueDate: document.dueDate }),
  }))

export const soldDocuments = (documents: readonly DocumentRecord[]): SoldDocument[] =>
  documents.map((document) => ({
    id: document.id,
    type: document.type,
    status: document.status,
    currency: document.currency,
    lineItems: document.lineItems,
    ...(document.issueDate === undefined ? {} : { issueDate: document.issueDate }),
  }))

export const statementDocuments = (documents: readonly DocumentRecord[]): StatementDocument[] =>
  documents
    .filter((document) => document.customerId !== undefined)
    .map((document) => ({
      id: document.id,
      type: document.type,
      status: document.status,
      customerId: document.customerId ?? '',
      total: totalOf(document),
      issuedReference: document.issuedReference,
      ...(document.issueDate === undefined ? {} : { issueDate: document.issueDate }),
    }))

/**
 * What `customerBalances` and `paymentBehaviour` need of an invoice.
 *
 * Nothing was billed until it was dated and issued (§M), so a draft without an
 * issue date is not here — it would inflate "billed all time" with work the
 * customer has never seen.
 */
export function billedInvoices(documents: readonly DocumentRecord[]): BilledInvoice[] {
  return documents
    .filter(
      (document) =>
        document.type === 'invoice' &&
        document.customerId !== undefined &&
        document.issueDate !== undefined,
    )
    .map((document) => ({
      id: document.id,
      customerId: document.customerId ?? '',
      status: document.status,
      total: totalOf(document),
      issueDate: document.issueDate ?? '',
      ...(document.dueDate === undefined ? {} : { dueDate: document.dueDate }),
    }))
}

/** Which customer each document belongs to — the ask box needs the mapping. */
export function customerOf(documents: readonly DocumentRecord[]): Map<string, string> {
  const pairs = new Map<string, string>()
  for (const document of documents) {
    if (document.customerId !== undefined) pairs.set(document.id, document.customerId)
  }
  return pairs
}

export function customerNames(customers: readonly Customer[]): Map<string, string> {
  return new Map(customers.map((customer) => [customer.id, customer.name]))
}

export function dueDates(documents: readonly DocumentRecord[]): Map<string, string> {
  const dates = new Map<string, string>()
  for (const document of documents) {
    if (document.dueDate !== undefined) dates.set(document.id, document.dueDate)
  }
  return dates
}

/**
 * The status word a list row shows: the derived money state for an issued
 * invoice, the derived validity for an issued quotation, and the stored status
 * everywhere else.
 */
export function displayStatus(
  document: DocumentRecord,
  payments: readonly Payment[],
  today: string,
  creditNotes: readonly CreditNote[] = [],
): string {
  if (document.status === 'draft' || document.status === 'void') return document.status

  if (document.type === 'invoice') {
    return deriveInvoiceState({
      status: document.status as 'issued',
      total: totalOf(document),
      outstanding: invoiceOutstanding(document.id, totalOf(document), payments, creditNotes),
      ...(document.dueDate === undefined ? {} : { dueDate: document.dueDate }),
      asOf: today,
    })
  }

  if (document.type === 'quotation') {
    const derived = deriveQuotationState({
      status: document.status as 'issued',
      ...(document.validUntil === undefined ? {} : { validUntil: document.validUntil }),
      asOf: today,
    })
    // "Open" is the absence of news; the stored word says more (§G).
    return derived === 'open' ? document.status : derived
  }

  return document.status
}

export interface ListRowOptions {
  readonly payments: readonly Payment[]
  readonly customers: readonly Customer[]
  readonly today: string
  readonly statusWords: Readonly<Record<string, string>>
  /** For a draft, which has no issued reference yet (§M). */
  readonly provisionalReference: (document: DocumentRecord) => string
  readonly creditNotes?: readonly CreditNote[]
  /**
   * Renders "Replaced by Rev 2" for a superseded offer. Passed in because the
   * words live in the catalogue (§S) and this module holds none.
   */
  readonly supersededLabel?: (revisionNumber: number) => string
}

/** One row per document, in the shape §G's list page draws. */
export function listRows(
  documents: readonly DocumentRecord[],
  options: ListRowOptions,
): ListRow[] {
  const names = customerNames(options.customers)

  return documents.map((document) => {
    const status = displayStatus(
      document,
      options.payments,
      options.today,
      options.creditNotes ?? [],
    )
    const name = document.customerId === undefined ? undefined : names.get(document.customerId)

    // §G's Rev 2, read from the chain rather than stored on the original.
    const newer = supersededBy(documents, document.id)
    const note =
      newer === null || options.supersededLabel === undefined
        ? undefined
        : options.supersededLabel(revisionNumberOf(documents, newer))

    return {
      id: document.id,
      reference: document.issuedReference ?? options.provisionalReference(document),
      status,
      statusLabel: options.statusWords[status] ?? status,
      ...(name === undefined ? {} : { customerName: name }),
      // A delivery document has no money column at all (§G, §I, §V).
      ...(document.type === 'waybill' ? {} : { amount: totalOf(document) }),
      ...(note === undefined ? {} : { note }),
    }
  })
}

/** The currencies a company has actually used, for the pickers that offer them. */
export function currenciesInUse(
  documents: readonly DocumentRecord[],
  fallback: CurrencyCode,
): CurrencyCode[] {
  const currencies = new Set<CurrencyCode>(documents.map((document) => document.currency))
  if (currencies.size === 0) currencies.add(fallback)
  return [...currencies].sort()
}

/**
 * The analytics page reads one document set two ways — ageing wants totals and
 * due dates, top items wants line items — so it gets one shape carrying both
 * rather than two lists that could drift out of step.
 */
export const analyticsRecords = (
  documents: readonly DocumentRecord[],
): (AgeingDocument & SoldDocument)[] =>
  documents.map((document) => ({
    id: document.id,
    type: document.type,
    status: document.status,
    total: totalOf(document),
    currency: document.currency,
    lineItems: document.lineItems,
    ...(document.dueDate === undefined ? {} : { dueDate: document.dueDate }),
    ...(document.issueDate === undefined ? {} : { issueDate: document.issueDate }),
  }))

export const documentsOf = (
  documents: readonly DocumentRecord[],
  type: DocumentType,
): DocumentRecord[] => documents.filter((document) => document.type === type)
