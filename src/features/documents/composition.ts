/**
 * Turning a stored document into something that can be drawn (§H, §I).
 *
 * The builder had all of this inline, which was fine while the builder was
 * the only screen that previewed anything. It is not: the saved document
 * shows itself too, and §4 puts a live page on that screen.
 *
 * Duplicating the composition is exactly the drift Rule #5 exists to stop —
 * two places deciding what a document says, disagreeing by a discount or a
 * frozen label, and only one of them being the thing that actually prints. So
 * it lives here, and both screens call it.
 *
 * Nothing in this file reaches for a repository or a clock. Everything it
 * needs is passed in, so it can be tested as the pure function it is.
 */

import type { AssetRecord, Company, Customer, DocumentRecord } from '../../data/repositories'
import type { DocumentType, FrozenLabels } from '../../domain/documents/types'
import type { IsoDay } from '../../domain/dates/calendar'
import { type LocaleProfile, numberingPrefix } from '../../domain/locale/profile'
import { type UiStrings, format } from '../../domain/locale/data/strings'
import { percentToPpm, ppmToPercent } from '../../domain/money/money'
import type { ComposableDocument, ComposeOptions } from '../../pdf/compose'
import { DEFAULT_TEMPLATE, type TemplateId, templateById } from '../../pdf/templates'
import type { DocumentDraft } from './builder'
import { revisionNumberOf } from './revision'

/** What this document replaces: §G's numbered Rev chain, or a reissue. */
export interface Replaces {
  readonly reference: string
  readonly revisionNumber?: number
}

/** The four choices the design step collects (§H). */
export interface Design {
  readonly templateId: TemplateId
  readonly showLogo: boolean
  readonly brandColour: string
  /** Whole percent, as the slider shows it. Stored as ppm (§V). */
  readonly discountPercent: number
}

/** Used when a record predates the design columns and the company has none. */
export const DEFAULT_BRAND_COLOUR = '#2b3fd6'

/**
 * The design a saved document was given, falling back to the company's.
 *
 * A record saved before the design columns existed carries none of these, and
 * a null there has always meant "whatever the app defaults to" — so that is
 * what it resolves to, rather than a guess about what was chosen.
 */
export function designOf(record: DocumentRecord | undefined, company: Company | null): Design {
  return {
    templateId: templateIdOf(record?.templateId),
    showLogo: record?.showLogo ?? true,
    brandColour: record?.brandColour ?? company?.brandColour ?? DEFAULT_BRAND_COLOUR,
    discountPercent:
      record?.discountRatePpm === undefined ? 0 : ppmToPercent(record.discountRatePpm),
  }
}

/** A stored id this build does not know falls back rather than throwing. */
export function templateIdOf(id: string | undefined): TemplateId {
  if (id === undefined) return DEFAULT_TEMPLATE
  try {
    return templateById(id).id
  } catch {
    return DEFAULT_TEMPLATE
  }
}

/**
 * The stored record, read as the draft the builder works on.
 *
 * Every field, not a chosen subset — a field the record holds and this drops
 * is one the builder silently loses on the next save.
 */
export function draftOf(record: DocumentRecord): DocumentDraft {
  return {
    type: record.type,
    currency: record.currency,
    lineItems: record.lineItems,
    ...(record.customerId === undefined ? {} : { customerId: record.customerId }),
    ...(record.issueDate === undefined ? {} : { issueDate: record.issueDate }),
    ...(record.dueDate === undefined ? {} : { dueDate: record.dueDate }),
    ...(record.validUntil === undefined ? {} : { validUntil: record.validUntil }),
    // A receipt's link to its payment has to reach the draft, or §K's "reject
    // a receipt without an effective payment" rejects every receipt.
    ...(record.paymentId === undefined ? {} : { paymentId: record.paymentId }),
    ...(record.linkedInvoiceId === undefined ? {} : { linkedInvoiceId: record.linkedInvoiceId }),
    ...(record.signatureAssetId === undefined ? {} : { signatureAssetId: record.signatureAssetId }),
    ...(record.deliveryAddress === undefined ? {} : { deliveryAddress: record.deliveryAddress }),
    ...(record.driverName === undefined ? {} : { driverName: record.driverName }),
    ...(record.vehicleNumber === undefined ? {} : { vehicleNumber: record.vehicleNumber }),
    ...(record.dispatchDate === undefined ? {} : { dispatchDate: record.dispatchDate }),
  }
}

/**
 * What this document replaces, derived from the documents.
 *
 * Nothing was ever written back onto the document it replaces (§G, Rule #5),
 * so "this one was replaced" is a READ over the list rather than a flag.
 *
 * Only a quotation carries a revision NUMBER — its chain is numbered, and §G
 * calls those Rev 2, Rev 3. A reissued receipt replaces exactly one cancelled
 * receipt and says only that.
 */
export function replacesOf(
  documents: readonly DocumentRecord[],
  record: DocumentRecord | undefined,
): Replaces | null {
  if (record?.supersedesId === undefined) return null
  const replaced = documents.find((row) => row.id === record.supersedesId)
  if (replaced === undefined) return null
  return {
    reference: replaced.issuedReference ?? '',
    ...(record.type === 'quotation' ? { revisionNumber: revisionNumberOf(documents, record) } : {}),
  }
}

export interface ComposableInput {
  readonly draft: DocumentDraft
  readonly design: Design
  readonly company: Company | null
  readonly customer: Customer | undefined
  readonly profile: LocaleProfile
  /** Set once issued; a draft shows a provisional reference instead. */
  readonly reference: string | null
  readonly status: string
  readonly frozenLabels: FrozenLabels | null
  readonly replaces: Replaces | null
  /**
   * Today, as a CALENDAR DAY — never an instant sliced to ten characters.
   * Slicing dated a document in UTC, which west of Greenwich is tomorrow for
   * the last hours of every evening.
   */
  readonly today: IsoDay
}

export function composableOf(input: ComposableInput): ComposableDocument {
  const { draft, design, company, customer, profile, reference, status, replaces, today } = input

  const provisional = (type: DocumentType): string =>
    `${company?.numberingPrefixes?.[type] ?? numberingPrefix(profile, type)}-…`

  return {
    type: draft.type,
    status,
    currency: draft.currency,
    reference: reference ?? provisional(draft.type),
    issueDate: draft.issueDate ?? today,
    ...(draft.dueDate === undefined ? {} : { dueDate: draft.dueDate }),
    lineItems: draft.lineItems,
    party: {
      name: customer?.name ?? '',
      ...(customer?.address === undefined ? {} : { address: customer.address }),
      ...(customer?.phone === undefined ? {} : { phone: customer.phone }),
    },
    frozenLabels: input.frozenLabels,
    ...(design.discountPercent === 0
      ? {}
      : { discountRate: percentToPpm(design.discountPercent) }),
    ...(company?.taxRatePpm === undefined ? {} : { taxRate: company.taxRatePpm }),
    ...(company?.whtRatePpm === undefined || draft.type !== 'invoice'
      ? {}
      : { whtRate: company.whtRatePpm }),
    ...(draft.driverName === undefined ? {} : { driverName: draft.driverName }),
    ...(draft.vehicleNumber === undefined ? {} : { vehicleNumber: draft.vehicleNumber }),
    // So the preview shows the page as it will print, signature and all.
    ...(draft.signatureAssetId === undefined ? {} : { signatureAssetId: draft.signatureAssetId }),
    ...(replaces === null ? {} : { replaces }),
  }
}

export interface ComposeOptionsInput {
  readonly company: Company | null
  readonly design: Design
  readonly strings: UiStrings
  readonly assets: readonly AssetRecord[]
}

export function composeOptionsOf(input: ComposeOptionsInput): Omit<ComposeOptions, 'profile'> {
  const { company, design, strings, assets } = input
  return {
    branding: {
      name: company?.name ?? '',
      nameStyle: company?.nameStyle ?? 'classic',
      logoSize: company?.logoSize ?? 'M',
      showLogo: design.showLogo,
      ...(company?.logoAssetId === undefined ? {} : { logoAssetId: company.logoAssetId }),
    },
    columnLabels: {
      description: strings.items.description,
      quantity: strings.items.quantity,
      amount: strings.totals.payable,
      unit: strings.items.unit,
    },
    ...(company?.bankFields === undefined ? {} : { bankValues: company.bankFields }),
    // The page prints the mark it names, so it needs the bytes behind the id.
    // Every signature the company owns, not just this one's: the preview
    // follows the pad without a reload (§I).
    assetUrls: Object.fromEntries(assets.map((asset) => [asset.id, asset.dataUrl])),
    // The words live in the catalogue (§S), so the page is handed the sentence
    // rather than the pieces. A numbered chain says which revision it is; a
    // reissued receipt only says what it replaces.
    replacesLabel: (replaces: { reference: string; revisionNumber?: number }) => {
      const replacesWhat = format(strings.revision.supersedes, { reference: replaces.reference })
      return replaces.revisionNumber === undefined
        ? replacesWhat
        : `${format(strings.revision.badge, { number: String(replaces.revisionNumber) })} · ${replacesWhat}`
    },
  }
}
