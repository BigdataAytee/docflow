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
import type { Money } from '../../domain/money/money'
import type { IsoDay } from '../../domain/dates/calendar'
import { type LocaleProfile, numberingPrefix } from '../../domain/locale/profile'
import { type UiStrings, format } from '../../domain/locale/data/strings'
import { percentToPpm, ppmToPercent } from '../../domain/money/money'
import type { ComposableDocument, ComposeOptions } from '../../pdf/compose'
import { DEFAULT_TEMPLATE, type TemplateId, templateById } from '../../pdf/templates'
import type { DocumentDraft } from './builder'
import { methodName } from '../payments/methods'
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
    /*
     * WHO SIGNED FOR IT — the four facts the RECEIVED BY block is made of.
     *
     * None of them were forwarded. `compose` has had a `signerName` on its
     * input since it was written and this mapper never set it, so the block
     * could not have filled even once the mark had a column of its own: the
     * page was asking for facts nothing handed over.
     *
     * That is the second bug species CLAUDE.md names — declared and never
     * reachably FILLED — and the reason the delivery appeared to work was
     * that signing overwrote `signatureAssetId`, printing the customer's mark
     * under the sender's caption. One bug hiding another.
     */
    ...(record.signerSignatureAssetId === undefined
      ? {}
      : { signerSignatureAssetId: record.signerSignatureAssetId }),
    /*
     * §V: a receipt's total IS the payment, and the record already holds it.
     * Carried onto the draft because the sum of the lines is the INVOICE's
     * total once the goods come across, and issuing off that sum would bill
     * the full amount for a part payment.
     */
    ...(record.type === 'receipt' ? { paidAmountMinor: record.totalMinor } : {}),
    /* The receipt's frozen balance, straight through to the page (Rule #5). */
    ...(record.balanceAfterMinor === undefined
      ? {}
      : { balanceAfterMinor: record.balanceAfterMinor }),
    /* And the two figures it is the remainder OF. */
    ...(record.invoiceTotalMinor === undefined
      ? {}
      : { invoiceTotalMinor: record.invoiceTotalMinor }),
    ...(record.paidBeforeMinor === undefined
      ? {}
      : { paidBeforeMinor: record.paidBeforeMinor }),
    ...(record.signerName === undefined ? {} : { signerName: record.signerName }),
    ...(record.signerRole === undefined ? {} : { signerRole: record.signerRole }),
    ...(record.signedAt === undefined ? {} : { signedAt: record.signedAt }),
    ...(record.deliveryAddress === undefined ? {} : { deliveryAddress: record.deliveryAddress }),
    ...(record.driverName === undefined ? {} : { driverName: record.driverName }),
    ...(record.vehicleNumber === undefined ? {} : { vehicleNumber: record.vehicleNumber }),
    ...(record.dispatchDate === undefined ? {} : { dispatchDate: record.dispatchDate }),
    ...(record.expectedDate === undefined ? {} : { expectedDate: record.expectedDate }),
    /*
     * THE FROZEN RATES COME BACK (Rule #5, §K).
     *
     * Without these the record's rate was written at issue and never read
     * again — `draftOf` is how a saved document becomes something the app can
     * render, so a rate that does not survive this function does not survive
     * reopening the document, and the page falls back to today's company
     * default. The declared-field sweep caught exactly that: "read but never
     * written".
     */
    ...(record.taxRatePpm === undefined ? {} : { taxRatePpm: record.taxRatePpm }),
    ...(record.whtRatePpm === undefined ? {} : { whtRatePpm: record.whtRatePpm }),
    ...(record.referenceOverride === undefined
      ? {}
      : { referenceOverride: record.referenceOverride }),
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
  /**
   * The reference of the invoice a receipt is evidence against (§E line 190).
   *
   * The id is on the record; the page needs the REFERENCE, which only a
   * caller holding the documents can resolve.
   */
  readonly againstReference?: string | undefined
  /**
   * The payment a receipt is evidence OF (§E line 190, §I).
   *
   * Nothing supplied this, so `buildReceiptEvidence` returned null on every
   * receipt ever printed and the evidence block — built, tested, and sitting
   * in `DocumentPage` — never once drew. A receipt said "RECEIPT" at the top
   * and then described the goods, with no amount paid, no date paid and no
   * method: the three facts that make it a receipt rather than an invoice
   * with a different title.
   *
   * This is the "declared and never reachably FILLED" shape CLAUDE.md warns
   * the sweep cannot see — the mapper assigns it, so a text scan reads a
   * write, and only opening a receipt shows the block is empty.
   */
  readonly payment?:
    | { readonly amount: Money; readonly at: string; readonly method?: string | undefined }
    | undefined
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
    /*
     * THE THREE FACTS THAT MAKE A RECEIPT A RECEIPT (§E line 190, §I).
     *
     * Amount, date paid and method — plus the invoice it is against. None of
     * them were ever supplied, so the evidence block in `DocumentPage` has
     * drawn nothing since it was written and every printed receipt described
     * the goods with no payment on it at all.
     */
    ...(draft.type === 'receipt' && input.payment !== undefined
      ? {
          paidAmount: input.payment.amount,
          paidAt: input.payment.at,
          ...(input.payment.method === undefined ? {} : { paidMethod: input.payment.method }),
        }
      : {}),
    ...(draft.type === 'receipt' && input.againstReference !== undefined
      ? { againstReference: input.againstReference }
      : {}),
    frozenLabels: input.frozenLabels,
    ...(design.discountPercent === 0
      ? {}
      : { discountRate: percentToPpm(design.discountPercent) }),
    /*
     * THE DOCUMENT'S OWN RATE FIRST (Rule #5, §K).
     *
     * This read the company default unconditionally, so an issued invoice
     * re-rendered with whatever Settings says TODAY — this year's percentage
     * printed beside a total frozen at last year's. A document that carries a
     * rate was computed at that rate and keeps it; only one with none falls
     * back, which is every draft and everything issued before the column.
     */
    ...((draft.taxRatePpm ?? company?.taxRatePpm) === undefined
      ? {}
      : { taxRate: (draft.taxRatePpm ?? company?.taxRatePpm) as number }),
    ...((draft.whtRatePpm ?? company?.whtRatePpm) === undefined || draft.type !== 'invoice'
      ? {}
      : { whtRate: (draft.whtRatePpm ?? company?.whtRatePpm) as number }),
    ...(draft.driverName === undefined ? {} : { driverName: draft.driverName }),
    ...(draft.vehicleNumber === undefined ? {} : { vehicleNumber: draft.vehicleNumber }),
    // So the preview shows the page as it will print, signature and all.
    ...(draft.signatureAssetId === undefined ? {} : { signatureAssetId: draft.signatureAssetId }),
    /*
     * The recipient's half, carried through to the page.
     *
     * `draftOf` above sets all four and this is where they cross into the
     * composable document. Leaving this out is exactly how the block stayed
     * empty after it had a column of its own — and nothing failed, because a
     * test that calls `composeDocument` directly proves compose CAN fill the
     * block, never that anything fills it.
     */
    ...(draft.signerSignatureAssetId === undefined
      ? {}
      : { signerSignatureAssetId: draft.signerSignatureAssetId }),
    ...(draft.balanceAfterMinor === undefined
      ? {}
      : { balanceAfterMinor: draft.balanceAfterMinor }),
    ...(draft.invoiceTotalMinor === undefined
      ? {}
      : { invoiceTotalMinor: draft.invoiceTotalMinor }),
    ...(draft.paidBeforeMinor === undefined
      ? {}
      : { paidBeforeMinor: draft.paidBeforeMinor }),
    ...(draft.signerName === undefined ? {} : { signerName: draft.signerName }),
    ...(draft.signerRole === undefined ? {} : { signerRole: draft.signerRole }),
    ...(draft.signedAt === undefined ? {} : { signedAt: draft.signedAt }),
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
      ...(company?.address === undefined ? {} : { address: company.address }),
      /*
       * The footer strip's three (§I). Empty strings are dropped as well as
       * undefined ones: a field an owner opened and left blank must not print
       * as a stranded separator between two things that are there.
       */
      ...(company?.phone ? { phone: company.phone } : {}),
      ...(company?.email ? { email: company.email } : {}),
      ...(company?.website ? { website: company.website } : {}),
      ...(company?.logoAssetId === undefined ? {} : { logoAssetId: company.logoAssetId }),
    },
    /* The owner's payment terms, printed under the totals (§I). */
    ...(company?.documentNote === undefined || company.documentNote.trim() === ''
      ? {}
      : { note: company.documentNote, noteLabel: strings.totals.noteToCustomer }),
    /* The words beside the figures above the total — see `ComposeOptions`. */
    totalsLabels: {
      subtotal: strings.totals.subtotal,
      tax: strings.totals.tax,
      withholding: strings.totals.withholding,
      payable: strings.totals.payable,
      received: strings.totals.received,
    },
    columnLabels: {
      description: strings.items.description,
      // A delivery's table lists what was handed over, not what was charged.
      goods: strings.items.goods,
      quantity: strings.items.quantity,
      amount: strings.totals.payable,
      unit: strings.items.unit,
    },
    ...(company?.bankFields === undefined ? {} : { bankValues: company.bankFields }),
    /*
     * §I: "online methods under a dashed divider labelled 'Other payment
     * methods', cash listed separately" — so everything switched on EXCEPT
     * bank transfer, whose account rows are the box itself.
     *
     * `otherPaymentMethods` had been on `ComposeOptions` from the start with
     * no caller supplying one, which meant switching a method on in Settings
     * changed nothing a customer ever saw. §J is explicit that "everything
     * switched on prints in invoice payment instructions".
     */
    otherPaymentMethods: (company?.enabledPaymentMethods ?? [])
      .filter((id) => id !== 'bank_transfer')
      .map((id) => methodName(strings, id)),
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
