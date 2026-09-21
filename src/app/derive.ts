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
import { type DocumentType, QUANTITY_SCALE, carriesMoney } from '../domain/documents/types'
import { deriveInvoiceState, deriveQuotationState } from '../domain/documents/lifecycle'
import { type CurrencyCode, type Money, money } from '../domain/money/money'
import { computeTotals } from '../domain/money/totals'
import { type CreditNote, invoiceOutstanding } from '../domain/payments/ledger'
import { replacedFollowUpIds, supersededBalanceIds } from '../domain/payments/supersession'
import type { StatDocument } from '../features/home/stats'
import type { AgeingDocument } from '../features/analytics/ageing'
import type { SoldDocument } from '../features/analytics/topItems'
import type { StatementDocument } from '../features/statements/compose'
import type { BilledInvoice } from '../features/customers/balance'
import type { ListRow } from '../features/documents/DocumentList'
import { revisionNumberOf, supersededBy } from '../features/documents/revision'
import { type RowActionKind, rowActionFor } from '../features/documents/rowAction'

export const totalOf = (document: DocumentRecord): Money =>
  money(document.currency, document.totalMinor)

/**
 * What a row should SHOW as this document's amount.
 *
 * THE STORED TOTAL IS ONLY TRUE ONCE ISSUED. `totalMinor` is what issuing
 * computes and freezes (Rule #5), so on a draft it is zero — and the list
 * printed that zero beside a draft holding ten items and most of a million
 * naira. "Draft · ₦0.00" tells the owner the draft is worth nothing, which is
 * the one thing it is not. Found by billing a balance on the phone and
 * watching the follow-up land in the list at ₦0.00 while its own Totals step
 * said ₦637,794.38.
 *
 * So a draft's figure is DERIVED from its lines, like every other derived
 * state in the app (Rule #3, §E), and issued documents keep reading the
 * frozen total — which is the whole point of freezing it.
 *
 * Returns null when there is nothing honest to show: a delivery carries no
 * money at all (§V), and a draft whose lines carry no prices yet has no
 * figure rather than a zero.
 */
export function shownTotalOf(document: DocumentRecord): Money | null {
  if (!carriesMoney(document.type)) return null
  if (document.status !== 'draft') return totalOf(document)

  const priced = document.lineItems.some((line) => line.unitPriceMinor !== undefined)
  if (!priced) return null

  return computeTotals({
    type: document.type,
    currency: document.currency,
    lines: document.lineItems,
    ...(document.taxRatePpm === undefined ? {} : { taxRate: document.taxRatePpm }),
    ...(document.whtRatePpm === undefined ? {} : { whtRate: document.whtRatePpm }),
  }).payable
}

/*
 * WORKED OUT ONCE, FOR ALL THREE PROJECTIONS.
 *
 * Home's Outstanding, the customer balance and the ageing report each sum the
 * same debts, so they have to agree about which invoice is asking for which
 * money. Computing it per projection would be three chances to disagree about
 * one number — which is the shape of the bug this exists to prevent.
 */
const supersededIn = (documents: readonly DocumentRecord[]): ReadonlySet<string> => {
  /*
   * TWO WAYS TO STOP BEING THE DOCUMENT THAT ASKS, and both have to be here
   * or the debt is counted twice:
   *
   *  · an ORIGINAL whose balance moved to a live follow-up;
   *  · a FOLLOW-UP that a newer follow-up has replaced.
   *
   * The second arrives with instalments. Every part payment produces a new
   * balance invoice, so paying in three leaves three follow-ups — and until
   * this line, the two older ones each still contributed their own stale
   * remainder to Home's Outstanding. That is the ₦190,000 bug
   * `supersession.ts` was written to kill, coming back through a door the
   * original fix did not cover.
   */
  const union = new Set(supersededBalanceIds(documents))
  for (const id of replacedFollowUpIds(documents)) union.add(id)
  return union
}

export const statDocuments = (documents: readonly DocumentRecord[]): StatDocument[] => {
  const superseded = supersededIn(documents)
  return documents.map((document) => ({
    id: document.id,
    type: document.type,
    status: document.status,
    total: totalOf(document),
    ...(superseded.has(document.id) ? { balanceSuperseded: true } : {}),
  }))
}

export const ageingDocuments = (documents: readonly DocumentRecord[]): AgeingDocument[] => {
  const superseded = supersededIn(documents)
  return documents.map((document) => ({
    id: document.id,
    type: document.type,
    status: document.status,
    total: totalOf(document),
    ...(document.dueDate === undefined ? {} : { dueDate: document.dueDate }),
    ...(superseded.has(document.id) ? { balanceSuperseded: true } : {}),
  }))
}

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
  const superseded = supersededIn(documents)
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
      ...(superseded.has(document.id) ? { balanceSuperseded: true } : {}),
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
  /** Every document, so a follow-up billing this one's balance can be seen. */
  all: readonly DocumentRecord[] = [],
): string {
  if (document.status === 'draft' || document.status === 'void') return document.status

  if (document.type === 'invoice') {
    /*
     * BILLED ELSEWHERE BEATS EVERY MONEY STATE, because it decides which
     * document the question is even about. An invoice whose balance a live
     * follow-up is asking for is not "paid" — the money did not arrive — and
     * not "part paid" either, which would leave it looking like something to
     * chase here. The screen says the split: what came in, and where the rest
     * is being asked for.
     */
    if (supersededBalanceIds(all).has(document.id)) return 'balance_billed'

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

/**
 * A delivery's row summary — "10 cartons", where an invoice shows its total.
 *
 * The quantity and the unit are the only summary a moneyless document has,
 * and the reference asks for exactly this rather than an empty space. One
 * line is named; several are counted, because a row cannot list them and a
 * number without a noun tells nobody anything.
 *
 * Null when there is nothing to say: an empty draft, or goods entered with
 * no unit yet. The row then simply shows no summary, which is honest —
 * inventing "10" with no noun would be the bug this exists to avoid.
 */
export function goodsSummary(document: DocumentRecord): string | null {
  const lines = document.lineItems
  if (lines.length === 0) return null

  if (lines.length === 1) {
    /*
     * The DESCRIPTION and the quantity — no unit.
     *
     * This read `${quantity} ${unit}` and returned null when there was no
     * unit, so a delivery of "10 × Cement 50kg" summarised as nothing at all
     * unless somebody had typed a noun. Waybills no longer carry a unit
     * column by the owner's decision, so the noun is the GOODS themselves,
     * which is the thing that actually identifies the delivery — "10 ×
     * Cement 50kg" says which one this is; "10 cartons" never did.
     */
    const line = lines[0]!
    const quantity = line.quantityMilli / QUANTITY_SCALE
    const name = line.description.trim()
    if (name === '') return null
    return `${quantity} × ${name}`
  }

  /*
   * More than one kind of thing: NO summary rather than a number.
   *
   * Quantities in different units cannot be added — 3 pallets and 10 cartons
   * are not 13 of anything — and a bare "2" sitting where an amount goes
   * reads as a quantity rather than as a line count. An empty space says
   * less and claims nothing, which is the better of the two.
   */
  return null
}

export interface ListRowOptions {
  readonly payments: readonly Payment[]
  readonly customers: readonly Customer[]
  readonly today: string
  readonly statusWords: Readonly<Record<string, string>>
  /**
   * What goes in the number column, and whether it is a fact yet (§M).
   *
   * A draft has no issued reference, and this used to return `INV-…` while
   * the builder's own card showed the number the draft would actually get.
   * One answer now — `shownReference` — carrying `provisional` so the row
   * can mute it rather than sitting a real-looking number unmarked in a
   * column of real ones.
   */
  readonly referenceOf: (document: DocumentRecord) => {
    readonly text: string
    readonly provisional: boolean
  }
  readonly creditNotes?: readonly CreditNote[]
  /**
   * Renders the "this one was replaced" line. Passed the document's TYPE as
   * well as the number, because a quotation's chain is numbered (§G's Rev 2)
   * and a reissued receipt's is not — calling a replaced receipt "Rev 2"
   * would say more than is true. The words live in the catalogue (§S); this
   * module holds none.
   */
  readonly supersededLabel?: (input: { type: DocumentType; revisionNumber: number }) => string
  /**
   * What the row's one action is CALLED, given what it does (§G, §D).
   *
   * A function rather than a map, for the same reason every other label on
   * this page is one: the words live in the catalogue and this module holds
   * none. Absent means the list draws no action at all.
   */
  readonly actionLabel?: (kind: RowActionKind) => string
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
    const shown = options.referenceOf(document)

    // §G's Rev 2, read from the chain rather than stored on the original.
    const newer = supersededBy(documents, document.id)
    const note =
      newer === null || options.supersededLabel === undefined
        ? undefined
        : options.supersededLabel({
            type: document.type,
            revisionNumber: revisionNumberOf(documents, newer),
          })

    return {
      id: document.id,
      reference: shown.text,
      provisional: shown.provisional,
      status,
      statusLabel: options.statusWords[status] ?? status,
      ...(name === undefined ? {} : { customerName: name }),
      // A delivery document has no money column at all (§G, §I, §V) — it
      // summarises its GOODS in that place instead, because "no amount" on
      // its own tells nobody which delivery this is.
      ...(document.type === 'waybill'
        ? { ...(goodsSummary(document) === null ? {} : { goodsSummary: goodsSummary(document)! }) }
        : /*
           * DERIVED ON A DRAFT, frozen once issued — see `shownTotalOf`.
           * Absent rather than zero when there is nothing honest to show.
           */
          (() => {
            const shownTotal = shownTotalOf(document)
            return shownTotal === null ? {} : { amount: shownTotal }
          })()),
      ...(note === undefined ? {} : { note }),
      /*
       * THE ROW'S ONE ACTION, from the DERIVED status rather than the stored
       * one. An invoice that is overdue is unpaid; a delivery marked
       * delivered is finished. Reading `document.status` here would offer
       * "Record payment" on a settled invoice and "Sign" on a signed
       * delivery, because the stored word is `issued` in both cases.
       */
      ...(() => {
        if (options.actionLabel === undefined) return {}
        const kind = rowActionFor({ type: document.type, status })
        return kind === null ? {} : { action: { kind, label: options.actionLabel(kind) } }
      })(),
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
