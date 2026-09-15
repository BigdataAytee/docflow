/**
 * §I — how a document composes on the page.
 *
 * This turns a document into a LAYOUT MODEL: a structured description of what
 * the page contains. The renderer draws it, and the native PDF writer draws
 * the same model, so screen and paper cannot diverge (§C: "Generated
 * on-device from the shared template definitions").
 *
 * Modelling it as data rather than markup is what lets §V's guarantees be
 * tested rather than eyeballed: a delivery document has `totals: null` and
 * `paymentBox: null` by construction, so there is no money to accidentally
 * render under any template.
 *
 * An ISSUED document composes from its FROZEN labels and language (§D.2, §M).
 * A later region change never reaches it.
 */

import {
  type DocumentType,
  type FrozenLabels,
  type LineItem,
  QUANTITY_SCALE,
  carriesMoney,
} from '../domain/documents/types'
import type { Money } from '../domain/money/money'
import { type DocumentTotals, computeTotals, lineTotal } from '../domain/money/totals'
import {
  type LocaleProfile,
  displayLabels,
  printedTitle,
  shared as sharedTerms,
} from '../domain/locale/profile'
import { fieldsFor } from '../domain/locale/bank-fields'

export interface CompanyBranding {
  readonly name: string
  readonly logoAssetId?: string
  readonly nameStyle: 'classic' | 'serif' | 'stacked' | 'ruled' | 'monogram'
  readonly logoSize: 'S' | 'M' | 'L'
  readonly showLogo: boolean
}

export interface PartySnapshot {
  readonly name: string
  readonly address?: string
  readonly phone?: string
  readonly email?: string
}

export interface ComposableDocument {
  readonly type: DocumentType
  readonly status: string
  readonly currency: string
  readonly reference: string
  readonly issueDate: string
  readonly dueDate?: string
  /**
   * What this document replaces, already worked out by the feature that made
   * it: §G's Rev 2 on a quotation, or a reissued receipt.
   *
   * The page prints it because the reference alone cannot say so — every
   * document earns its own (§M) — and because the person holding the older
   * one has no other way to tell. On a receipt that is not cosmetic: two
   * receipts for one payment, neither mentioning the other, is how a payment
   * gets read as two (§V).
   *
   * `revisionNumber` is present only where the chain is numbered.
   */
  readonly replaces?: { readonly reference: string; readonly revisionNumber?: number }
  readonly lineItems: readonly LineItem[]
  readonly party: PartySnapshot
  /** Set at issue and never rewritten (§M). Null on a draft. */
  readonly frozenLabels: FrozenLabels | null
  readonly signatureAssetId?: string
  readonly signerName?: string
  readonly discountRate?: number
  readonly taxRate?: number
  readonly whtRate?: number
  /** Receipts: what was paid, when and how. Never an instruction to pay (§I). */
  readonly paidAmount?: Money
  readonly paidAt?: string
  readonly paidMethod?: string
  /** Delivery documents. */
  readonly driverName?: string
  readonly vehicleNumber?: string
}

export interface TableColumn {
  readonly key: 'description' | 'quantity' | 'unit' | 'amount'
  readonly label: string
  readonly align: 'left' | 'right'
}

export interface TableRow {
  readonly description: string
  readonly quantity: string
  readonly unit?: string
  /** Absent on a delivery document — the column does not exist there (§I). */
  readonly amount?: Money
  readonly photoAssetId?: string
}

export interface PaymentBoxRow {
  readonly label: string
  readonly value: string
}

export interface PaymentBox {
  readonly heading: string
  readonly rows: readonly PaymentBoxRow[]
  readonly otherMethods: readonly string[]
  /** §I: "inline at ≤ ~60% width beside the signature, never a full-width band." */
  readonly maxWidthPercent: number
}

export interface ReceiptEvidence {
  readonly amount: Money
  readonly paidAt: string
  readonly method: string
}

export interface PageModel {
  readonly type: DocumentType
  readonly language: string
  readonly branding: CompanyBranding
  readonly title: string
  readonly reference: string
  /** Already in words, in the document's own language. Null when it replaces nothing. */
  readonly replacesLine: string | null
  readonly partyLabel: string
  readonly party: PartySnapshot
  readonly issueDate: string
  readonly dueDate?: string
  readonly columns: readonly TableColumn[]
  readonly rows: readonly TableRow[]
  /** Null on a delivery document. There is no zero total to print (§V). */
  readonly totals: DocumentTotals | null
  /** §H: a quotation says the localised "Estimated total". */
  readonly totalsLabel: string | null
  /** Invoices only. Quotations omit payment instructions by default (§I). */
  readonly paymentBox: PaymentBox | null
  /** Delivery documents replace the payment box with this rule (§I). */
  readonly receivedByRule: string | null
  /** Receipts show what was paid — never an instruction to pay again (§I). */
  readonly receiptEvidence: ReceiptEvidence | null
  readonly signature: {
    readonly assetId?: string
    /**
     * §I: "the actual captured signature (placeholders only in clearly-labelled
     * samples)". Absent when the document carries no signature OR when its
     * asset is not to hand — a page prints the rule and the caption with
     * nothing above them rather than a stand-in mark nobody made.
     */
    readonly imageUrl?: string
    readonly caption: string
    readonly signerName?: string
  }
  /** §I: totals right-aligned at 58% width. */
  readonly totalsWidthPercent: number
}

export interface ComposeOptions {
  readonly profile: LocaleProfile
  readonly branding: CompanyBranding
  /** Column headings, already in the active language. */
  readonly columnLabels: Readonly<Record<TableColumn['key'], string>>
  /** The saved bank details, keyed by §J field kind. */
  readonly bankValues?: Readonly<Record<string, string>>
  /** Other enabled methods, by display name (§I dashed divider). */
  readonly otherPaymentMethods?: readonly string[]
  /** Asset id → data URL, so the page can print the signature it names. */
  readonly assetUrls?: Readonly<Record<string, string>>
  /**
   * Renders "Rev 2 · Replaces QUO-0009", or just "Replaces REC-0003". Passed
   * in rather than built here, because the words live in the catalogue (§S)
   * and this module holds none.
   */
  readonly replacesLabel?: (replaces: {
    reference: string
    revisionNumber?: number
  }) => string
}

export function composeDocument(
  document: ComposableDocument,
  options: ComposeOptions,
): PageModel {
  const { profile, branding } = options
  const labels = displayLabels(profile, document.type, document.frozenLabels)
  const terms = sharedTerms(profile)
  const showsMoney = carriesMoney(document.type)

  const columns: TableColumn[] = showsMoney
    ? [
        { key: 'description', label: options.columnLabels.description, align: 'left' },
        { key: 'quantity', label: options.columnLabels.quantity, align: 'right' },
        { key: 'amount', label: options.columnLabels.amount, align: 'right' },
      ]
    : // §I: "deliveries swap amount for unit and drop every money column".
      [
        { key: 'description', label: options.columnLabels.description, align: 'left' },
        { key: 'quantity', label: options.columnLabels.quantity, align: 'right' },
        { key: 'unit', label: options.columnLabels.unit, align: 'right' },
      ]

  const rows: TableRow[] = document.lineItems.map((line) => ({
    description: line.description,
    quantity: String(line.quantityMilli / QUANTITY_SCALE),
    /*
     * The UNIT, which the column above has asked for since it was written
     * and no row ever supplied.
     *
     * §I swaps amount for unit on a delivery, and the header did exactly
     * that — so every printed waybill has had a UNIT column with nothing
     * under it. "10" against "10 cartons" is the difference between a
     * document somebody can sign for and a number, and this is the column
     * that was meant to say which.
     */
    ...(line.unit === undefined ? {} : { unit: line.unit }),
    ...(showsMoney ? { amount: lineTotal(document.currency, line) } : {}),
  }))

  const totals: DocumentTotals | null = showsMoney
    ? computeTotals({
        type: document.type,
        currency: document.currency,
        lines: document.lineItems,
        ...(document.discountRate === undefined ? {} : { discountRate: document.discountRate }),
        ...(document.taxRate === undefined ? {} : { taxRate: document.taxRate }),
        ...(document.type === 'invoice' && document.whtRate !== undefined
          ? { whtRate: document.whtRate }
          : {}),
      })
    : null

  return {
    type: document.type,
    language: labels.language,
    branding,
    // Frozen at issue, so a shared PDF never changes language later (§D.2).
    title: document.frozenLabels?.printedTitle ?? printedTitle(profile, document.type),
    reference: document.reference,
    replacesLine:
      document.replaces === undefined || options.replacesLabel === undefined
        ? null
        : options.replacesLabel(document.replaces),
    partyLabel: labels.partyLabel,
    party: document.party,
    issueDate: document.issueDate,
    ...(document.dueDate === undefined ? {} : { dueDate: document.dueDate }),
    columns,
    rows,
    totals,
    totalsLabel: totals === null ? null : totalsLabelFor(document.type, terms),
    paymentBox: buildPaymentBox(document, options, terms),
    // §I: deliveries replace the payment box with the localised RECEIVED BY.
    receivedByRule: showsMoney ? null : terms.receivedBy,
    receiptEvidence: buildReceiptEvidence(document),
    signature: {
      ...(document.signatureAssetId === undefined ? {} : { assetId: document.signatureAssetId }),
      ...(document.signatureAssetId === undefined ||
      options.assetUrls?.[document.signatureAssetId] === undefined
        ? {}
        : { imageUrl: options.assetUrls[document.signatureAssetId] }),
      caption: labels.signatureCaption,
      ...(document.signerName === undefined ? {} : { signerName: document.signerName }),
    },
    totalsWidthPercent: 58,
  }
}

function totalsLabelFor(
  type: DocumentType,
  terms: ReturnType<typeof sharedTerms>,
): string | null {
  // §H: "quotations say the localised 'Estimated total'".
  return type === 'quotation' ? terms.estimatedTotal : null
}

function buildPaymentBox(
  document: ComposableDocument,
  options: ComposeOptions,
  terms: ReturnType<typeof sharedTerms>,
): PaymentBox | null {
  // §I: invoices print the payment box. Quotations omit payment instructions
  // by default, deliveries carry none, and a receipt shows what was already
  // paid rather than how to pay.
  if (document.type !== 'invoice') return null

  const values = options.bankValues ?? {}
  const rows = fieldsFor(document.currency)
    .map((field) => ({ label: field.label, value: values[field.kind]?.trim() ?? '' }))
    .filter((row) => row.value !== '')

  if (rows.length === 0 && (options.otherPaymentMethods ?? []).length === 0) return null

  return {
    heading: terms.howToPay,
    rows,
    otherMethods: options.otherPaymentMethods ?? [],
    maxWidthPercent: 60,
  }
}

function buildReceiptEvidence(document: ComposableDocument): ReceiptEvidence | null {
  if (document.type !== 'receipt') return null
  if (document.paidAmount === undefined || document.paidAt === undefined) return null
  return {
    amount: document.paidAmount,
    paidAt: document.paidAt,
    method: document.paidMethod ?? '',
  }
}
