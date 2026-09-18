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
  carriesItemPhotos,
  carriesMoney,
} from '../domain/documents/types'
import { type Money, money } from '../domain/money/money'
import { type DocumentTotals, computeTotals, lineTotal } from '../domain/money/totals'
import {
  type LocaleProfile,
  displayLabels,
  printedTitle,
  shared as sharedTerms,
} from '../domain/locale/profile'
import { formatDocumentDate } from '../domain/locale/dates'
import { fieldsFor } from '../domain/locale/bank-fields'

export interface CompanyBranding {
  readonly name: string
  /** The business address, where a template has somewhere to put one (§F). */
  readonly address?: string
  /**
   * How a customer reaches the business — the footer strip (§I).
   *
   * Each optional (Rule #1). The strip prints whichever are present and does
   * not appear at all when none are, so a business with only a phone number
   * gets a phone number rather than two stranded separators.
   */
  readonly phone?: string
  readonly email?: string
  readonly website?: string
  readonly logoAssetId?: string
  /**
   * The bytes behind that id, resolved by `composeDocument` from
   * `assetUrls` — the same way a signature gets its `imageUrl`.
   *
   * A caller never supplies this. The page names an asset; compose is what
   * turns a name into something that can be drawn, so a logo cannot be shown
   * that the repository did not hand over.
   */
  readonly logoUrl?: string
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
  /** The BUSINESS's mark, printed under the localised signature caption. */
  readonly signatureAssetId?: string
  /** The RECIPIENT's, and the three facts that go with it (§E, §P). */
  readonly signerSignatureAssetId?: string
  readonly signerName?: string
  readonly signerRole?: string
  readonly signedAt?: string
  readonly discountRate?: number
  readonly taxRate?: number
  readonly whtRate?: number
  /** Receipts: what was paid, when and how. Never an instruction to pay (§I). */
  readonly paidAmount?: Money
  readonly paidAt?: string
  readonly paidMethod?: string
  /**
   * What was still owed on the linked invoice AFTER this payment, in minor
   * units — frozen onto the record at issue (Rule #5), never recomputed.
   *
   * Undefined on a standalone receipt, which settles no debt. Zero means the
   * payment cleared it, and prints "Paid in full" rather than a zero.
   */
  readonly balanceAfterMinor?: number
  /** The bill this settles, and what had arrived before — frozen (Rule #5). */
  readonly invoiceTotalMinor?: number
  readonly paidBeforeMinor?: number
  /**
   * The reference of the invoice this receipt is evidence against.
   *
   * §E line 190: "receipts show date paid, LINKED INVOICE, method +
   * reference". The link was on the record and never reached the page, so a
   * printed receipt said money arrived and not what it was for — which is the
   * one question the person filing it will have.
   *
   * Absent on a standalone receipt, which is a real case (§G: a payment that
   * stands alone, never inventing a duplicate invoice).
   */
  readonly againstReference?: string
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
  /**
   * §I's "thumbnail if a photo was attached", resolved to a `data:` URL.
   *
   * The URL rather than the asset id, because the page draws it and §M says
   * nothing needed to open a saved document touches a CDN — so the image is
   * already in hand or the row simply has none. An id the asset store cannot
   * resolve prints no thumbnail rather than a broken one.
   */
  readonly imageUrl?: string
}

export interface PaymentBoxRow {
  readonly label: string
  readonly value: string
}

export interface PaymentBox {
  readonly heading: string
  readonly rows: readonly PaymentBoxRow[]
  readonly otherMethods: readonly string[]
  /** §I: the label on the dashed divider above them. */
  readonly otherMethodsLabel: string
  /** §I: "inline at ≤ ~60% width beside the signature, never a full-width band." */
  readonly maxWidthPercent: number
}

/** The recipient's block on a delivery — caption, mark, and who signed (§I). */
export interface ReceivedBy {
  readonly caption: string
  /**
   * The drawn mark, resolved to something drawable.
   *
   * Absent when nobody has signed yet, and ALSO absent when the asset cannot
   * be resolved — the same rule the business's own signature follows. A page
   * may only print a mark the repository actually handed over; a missing one
   * prints the rule alone rather than a broken image over a claim that
   * somebody signed (§P).
   */
  readonly markUrl?: string
  readonly name?: string
  readonly role?: string
  /** Already formatted for the document's locale — never a raw ISO string. */
  readonly signedOn?: string
}

/**
 * What makes a receipt a receipt (§I, §K).
 *
 * §E: "receipts show date paid, linked invoice, method + reference". It takes
 * the footer slot an invoice gives to HOW TO PAY and a delivery gives to
 * RECEIVED BY — the reference sends every non-delivery type through that same
 * slot — because a receipt says what was already paid rather than how to pay.
 *
 * Carries its own HEADING and LABELS, resolved at compose time like every
 * other printed word (Rule #4): the page renders a model and never reaches
 * for the locale layer itself.
 */
export interface ReceiptEvidence {
  readonly heading: string
  readonly amount: Money
  readonly paidAt: string
  /** "Against INV-0042", when this receipt has an invoice behind it. */
  readonly against?: string
  readonly againstLabel: string
  readonly datePaidLabel: string
  /** Absent when no method was recorded — never an empty row. */
  readonly method?: string
  readonly methodLabel: string
  /**
   * WHAT IS STILL OWED AFTER THIS PAYMENT, frozen at issue.
   *
   * A customer holding a receipt for ₦500,000 against a ₦1,000,000 invoice
   * needs to know they still owe ₦500,000 — and the app knew and did not say,
   * so the paper answered half the question it exists to answer.
   *
   * FROZEN, like the reference and the labels (Rule #5). Computed live it
   * would say something different every time the PDF was opened, as later
   * payments arrived: a customer comparing the sheet in their hand with the
   * one in their email would find two receipts for one payment disagreeing
   * about a fact neither of them can have changed.
   *
   * Absent on a standalone receipt — there is no debt to report the state of,
   * and a "Balance remaining: ₦0" on a cash sale invents one.
   */
  readonly balanceRemaining?: Money
  readonly balanceRemainingLabel: string
  /**
   * WHAT THE BILL WAS AND WHAT HAD ALREADY ARRIVED, frozen with the balance.
   *
   * A receipt showing only the amount handed over answers one of the four
   * questions its holder has: what was the bill, what had I paid, what did I
   * just pay, what is left. These are the first two.
   *
   * Absent together on a standalone receipt, which settles no invoice and has
   * no such picture to show — never a zero, which would claim a bill of
   * nothing.
   */
  readonly invoiceTotal?: Money
  readonly invoiceTotalLabel: string
  readonly paidBefore?: Money
  readonly paidBeforeLabel: string
  readonly paidNowLabel: string
  /**
   * Printed INSTEAD of the balance when this payment cleared the debt.
   *
   * "Balance remaining: ₦0.00" is arithmetically the same and reads as an
   * oversight; "Paid in full" is what the person holding it wants to see.
   */
  readonly paidInFull?: string
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
  /**
   * The words beside the figures above the total.
   *
   * These lines printed as BARE NUMBERS — `<Line label="" …>` — so a document
   * showed a right-aligned column of amounts with nothing saying which was
   * the subtotal and which was tax. A customer reading two figures and a
   * total has to guess what the middle one is, and on a document with
   * withholding the guess is about money they are owed.
   *
   * Through the options like `columnLabels`, not through the terminology
   * table: §D gates that table on native-speaker sign-off, and these come
   * from the UI catalogue that is already translated with the screen.
   */
  readonly subtotalLabel: string
  readonly taxLabel: string | null
  readonly whtLabel: string | null
  /** Invoices only. Quotations omit payment instructions by default (§I). */
  readonly paymentBox: PaymentBox | null
  /**
   * The RECIPIENT's half of a delivery: the caption, and what they left on it.
   *
   * This was a bare `receivedByRule: string | null` — a caption over an empty
   * rule, and empty FOREVER, because the mark a customer drew at the gate was
   * written into `signature.assetId` (the business's) and printed under the
   * business's caption with the business's name. The one block on the page
   * that belongs to the person receiving the goods was the only one that
   * could never say anything.
   *
   * `mark`, `name`, `role` and `signedOn` are each absent until there is one:
   * an unsigned delivery still prints the caption and the rule, which is what
   * somebody signs ON.
   */
  readonly receivedBy: ReceivedBy | null
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
    /**
     * The business the signature commits, printed under the caption.
     *
     * Every legacy document carries it — "AUTHORISED SIGNATORY" then the
     * company name — because a signature over a bare rule says somebody
     * signed and not on whose behalf.
     */
    readonly signerBusiness?: string
  }
  /** §I: totals right-aligned at 58% width. */
  readonly totalsWidthPercent: number
  /**
   * THE HEADLINE FIGURE, in the header (§I).
   *
   * Every legacy document puts the amount owed at the TOP, large, beside the
   * title — "BALANCE DUE ₦322,500.00". It is the first thing the recipient
   * needs and ours made them find it at the bottom of the totals stack.
   *
   * Null on a delivery, which carries no money at all (§V).
   */
  readonly headline: { readonly label: string; readonly amount: Money } | null
  /**
   * The NOTE TO CUSTOMER block (§I): payment terms in the owner's own words.
   *
   * Null when the owner has written none — an empty heading with nothing
   * under it says less than no heading (Rule #1).
   */
  readonly note: { readonly label: string; readonly body: string } | null
}

export interface ComposeOptions {
  readonly profile: LocaleProfile
  /**
   * The region's date order (§D). Optional so every existing caller keeps
   * working; absent means the day-first order the default profile uses.
   */
  readonly dateFormat?: string
  /**
   * A stored payment method id, as a person reads it (§D, Rule #4).
   *
   * The receipt printed `bank_transfer` — the database's word, on a document
   * handed to a customer — while the form that collected it said "Bank
   * transfer" two lines above. The id is what the ledger stores and must keep
   * storing; the NAME is a display concern, so it resolves here through the
   * catalogue like every other word on the page.
   *
   * A resolver rather than a lookup table, because a method the business has
   * since switched off still has to print on receipts issued while it was on
   * (Rule #5) — and a table built from what is enabled today would not have it.
   */
  readonly paymentMethodLabel?: (id: string) => string
  readonly branding: CompanyBranding
  /**
   * The words beside the figures above the total.
   *
   * Through the options like `columnLabels`, not through the terminology
   * table: §D gates that table on native-speaker sign-off, and these come
   * from the UI catalogue that is already translated with the screen.
   */
  /** The owner's payment terms, printed under the totals (§I). */
  readonly note?: string
  readonly noteLabel?: string
  readonly totalsLabels?: {
    readonly subtotal: string
    readonly tax: string
    readonly withholding: string
    readonly payable: string
    readonly received: string
  }
  /**
   * Column headings, already in the active language.
   *
   * `goods` is not a column KEY — a delivery's first column is still
   * `description` — it is what that column is CALLED when the table lists
   * things handed over rather than things charged for. §G heads the
   * delivery's own step GOODS and the reference heads the printed table the
   * same way; the page had been using "Description" for both.
   *
   * OPTIONAL, and falling back to `description`, so that a caller which has
   * no delivery to draw is not made to supply a word it never prints. The
   * app's own composition always passes it — `composition.test.ts` asserts
   * the delivery table is headed GOODS through that path, so the fallback
   * cannot quietly become what ships.
   */
  readonly columnLabels: Readonly<Record<TableColumn['key'], string>> & {
    readonly goods?: string
  }
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
    : /*
       * A delivery is DESCRIPTION and QUANTITY. Nothing else.
       *
       * §I said "deliveries swap amount for unit and drop every money
       * column", and that is what this did. The owner has since decided
       * against the unit column on waybills — deliberately, having used it —
       * so it is gone from the printed table, from the builder's Goods step
       * and from the row summary together. A column removed from one of the
       * three and left in the others is the drift §J spends its whole section
       * preventing.
       *
       * `unit` itself is NOT deleted from the row model: invoices and
       * quotations still print it, and `SavedItem.unit` still carries it.
       * Only the delivery table stops asking.
       */
      [
        {
          key: 'description',
          label: options.columnLabels.goods ?? options.columnLabels.description,
          align: 'left',
        },
        { key: 'quantity', label: options.columnLabels.quantity, align: 'right' },
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
    /*
     * THE PICTURE OF THE GOODS (§E, §G step 2, §I).
     *
     * Not on a receipt: it is evidence that money arrived, and the goods were
     * described on the invoice it settles — which carries the photographs
     * already. `carriesItemPhotos` is the domain's rule, so the builder's
     * control and this page cannot disagree about which types show them.
     *
     * Resolved through the same `assetUrls` map as the logo and the
     * signature. An id nothing resolves prints no thumbnail rather than a
     * broken image on a document claiming to show the goods.
     */
    ...(!carriesItemPhotos(document.type) ||
    line.imageAssetId === undefined ||
    options.assetUrls?.[line.imageAssetId] === undefined
      ? {}
      : { imageUrl: options.assetUrls[line.imageAssetId] }),
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

  const logoUrl =
    branding.logoAssetId === undefined ? undefined : options.assetUrls?.[branding.logoAssetId]

  return {
    type: document.type,
    language: labels.language,
    branding: { ...branding, ...(logoUrl === undefined ? {} : { logoUrl }) },
    // Frozen at issue, so a shared PDF never changes language later (§D.2).
    title: document.frozenLabels?.printedTitle ?? printedTitle(profile, document.type),
    reference: document.reference,
    replacesLine:
      document.replaces === undefined || options.replacesLabel === undefined
        ? null
        : options.replacesLabel(document.replaces),
    partyLabel: labels.partyLabel,
    party: document.party,
    /*
     * FORMATTED HERE, at the one place every document type passes through.
     *
     * These were the stored strings, straight onto the page — which is how
     * `2026-09-04T00:00:00.000Z` came to be printed on a quotation sent to a
     * customer. Doing it in `compose` rather than in the page component means
     * every type, every template and the PDF all get it from one line: a new
     * design cannot forget, and neither can a new document type.
     */
    issueDate: formatDocumentDate(document.issueDate, options.dateFormat),
    ...(document.dueDate === undefined
      ? {}
      : { dueDate: formatDocumentDate(document.dueDate, options.dateFormat) }),
    columns,
    rows,
    totals,
    /*
     * THE FIGURE UNDER THE GOODS IS WHAT THE GOODS COME TO.
     *
     * On a receipt that settles an invoice the rows are the INVOICE'S items,
     * so the sum beneath them is the bill — and labelling it "Received" would
     * put the word for the payment over the figure for the debt. A customer
     * reading a part-payment receipt would see the full amount marked
     * received. It is labelled as the invoice total instead, and the money
     * that actually arrived is the headline and the evidence block.
     */
    totalsLabel:
      totals === null
        ? null
        : document.type === 'receipt' && document.invoiceTotalMinor !== undefined
          ? terms.invoiceTotal
          : totalsLabelFor(document.type, terms, options.totalsLabels),
    /*
     * AND THE HEADLINE IS THE PAYMENT (§V).
     *
     * It read `totals.payable` — the sum of the lines — which was the payment
     * only because a receipt used to hold one synthetic line priced at it.
     * With the invoice's own goods on the page that accident breaks, and the
     * big figure at the top of a ₦95,000 receipt would read ₦190,000.
     */
    headline:
      totals === null
        ? null
        : {
            label: totalsLabelFor(document.type, terms, options.totalsLabels) ?? '',
            amount:
              document.type === 'receipt' && document.paidAmount !== undefined
                ? document.paidAmount
                : totals.payable,
          },
    /*
     * NOT ON A RECEIPT, which is the one type it contradicts.
     *
     * The note is the owner's PAYMENT TERMS — "Payment is due within 14 days"
     * — printed on every document. A receipt is evidence that the money
     * already arrived, so it was going out with proof of payment above and an
     * instruction to pay below it, on the same sheet, about the same money.
     *
     * `buildReceiptEvidence` a few lines down already carries the rule in its
     * own comment: "never an instruction to pay again (§I)". The evidence
     * block obeyed it and the note block never knew about it.
     *
     * The owner writes ONE note, in Settings, for all their documents. Asking
     * them to write a second one that says nothing about payment, for the one
     * type where the first is wrong, would be a new required field (Rule #1)
     * to solve a problem the document type already answers.
     */
    note:
      document.type === 'receipt' ||
      options.note === undefined ||
      options.note.trim() === ''
        ? null
        : { label: options.noteLabel ?? 'NOTE TO CUSTOMER', body: options.note.trim() },
    subtotalLabel: options.totalsLabels?.subtotal ?? 'Subtotal',
    taxLabel:
      totals === null || totals.tax.minor === 0
        ? null
        : (options.totalsLabels?.tax ?? 'Tax'),
    whtLabel:
      totals === null || totals.wht.minor === 0
        ? null
        : (options.totalsLabels?.withholding ?? 'Less withholding tax'),
    paymentBox: buildPaymentBox(document, options, terms),
    // §I: deliveries replace the payment box with the localised RECEIVED BY.
    receivedBy: showsMoney ? null : buildReceivedBy(document, terms, options),
    receiptEvidence: buildReceiptEvidence(document, terms, options),
    signature: {
      ...(document.signatureAssetId === undefined ? {} : { assetId: document.signatureAssetId }),
      ...(document.signatureAssetId === undefined ||
      options.assetUrls?.[document.signatureAssetId] === undefined
        ? {}
        : { imageUrl: options.assetUrls[document.signatureAssetId] }),
      caption: labels.signatureCaption,
      /* Whose signature it is — the business it commits (§I). */
      ...(branding.name.trim() === '' ? {} : { signerBusiness: branding.name }),
      /*
       * `signerName` IS NOT READ HERE, and that is the fix.
       *
       * It is the RECIPIENT — §E defines it as "who took delivery" — and this
       * block is the sender's. Printing it here put the customer's name under
       * "DISPATCHED BY", beneath the business's own name, on the one document
       * where the distinction is the whole point. It belongs to `receivedBy`.
       */
    },
    totalsWidthPercent: 58,
  }
}

/**
 * The word on the grand total line.
 *
 * §H gives quotations the localised "Estimated total" and said nothing about
 * the rest, so everything else returned NULL and an invoice printed its
 * grand total as a bare figure — directly beneath a line that now reads
 * "Subtotal", which makes the omission look deliberate and wrong rather than
 * merely bare.
 *
 * The quotation term still comes from the terminology table, because §H names
 * it and §D owns it. The others come through the options from the UI
 * catalogue, the same route `columnLabels` takes.
 */
function totalsLabelFor(
  type: DocumentType,
  terms: ReturnType<typeof sharedTerms>,
  labels: ComposeOptions['totalsLabels'],
): string | null {
  if (type === 'quotation') return terms.estimatedTotal
  if (type === 'receipt') return labels?.received ?? 'Received'
  return labels?.payable ?? 'Payable'
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
    otherMethodsLabel: terms.otherPaymentMethods,
    maxWidthPercent: 60,
  }
}

/**
 * The recipient's block on a delivery (§I, §E, §P).
 *
 * Drawn on EVERY delivery, signed or not: unsigned it is the caption over the
 * rule somebody puts their hand on, which is what makes the paper usable at
 * the gate. Signed, it carries the mark they drew, their name, their role and
 * the date — the four facts that turn a delivery note into proof.
 *
 * The mark comes from `signerSignatureAssetId`, never from
 * `signatureAssetId`. The two were one column, which is how the customer's
 * hand came to be printed under the sender's caption.
 */
function buildReceivedBy(
  document: ComposableDocument,
  terms: ReturnType<typeof sharedTerms>,
  options: ComposeOptions,
): ReceivedBy {
  const assetId = document.signerSignatureAssetId
  const markUrl = assetId === undefined ? undefined : options.assetUrls?.[assetId]
  return {
    caption: terms.receivedBy,
    /*
     * A mark only when the repository actually handed the bytes over. An
     * unresolvable asset prints the rule alone rather than a broken image
     * over a claim that somebody signed (§P) — the same rule the business's
     * own signature follows a few lines above.
     */
    ...(markUrl === undefined ? {} : { markUrl }),
    ...(document.signerName === undefined || document.signerName.trim() === ''
      ? {}
      : { name: document.signerName }),
    ...(document.signerRole === undefined || document.signerRole.trim() === ''
      ? {}
      : { role: document.signerRole }),
    // Formatted like every other date on the page, never a raw ISO string.
    ...(document.signedAt === undefined
      ? {}
      : { signedOn: formatDocumentDate(document.signedAt, options.dateFormat) }),
  }
}

function buildReceiptEvidence(
  document: ComposableDocument,
  terms: ReturnType<typeof sharedTerms>,
  options: ComposeOptions,
): ReceiptEvidence | null {
  if (document.type !== 'receipt') return null
  if (document.paidAmount === undefined || document.paidAt === undefined) return null
  return {
    heading: terms.paymentReceived,
    amount: document.paidAmount,
    /*
     * FORMATTED, like every other date on the page. This one printed the
     * stored value: the issue and due dates go through `formatDocumentDate`
     * at the top of this function and the date PAID — the date that makes a
     * receipt a receipt — was left as it came out of the database.
     */
    paidAt: formatDocumentDate(document.paidAt, options.dateFormat),
    datePaidLabel: terms.datePaid,
    againstLabel: terms.against,
    ...(document.againstReference === undefined || document.againstReference === ''
      ? {}
      : { against: document.againstReference }),
    // Omitted rather than blank: a row reading "Paid by —" says less than no
    // row at all, and claims a field was recorded when it was not.
    ...(document.paidMethod === undefined || document.paidMethod === ''
      ? {}
      : { method: options.paymentMethodLabel?.(document.paidMethod) ?? document.paidMethod }),
    methodLabel: terms.paidBy,
    balanceRemainingLabel: terms.balanceRemaining,
    invoiceTotalLabel: terms.invoiceTotal,
    paidBeforeLabel: terms.paidBefore,
    paidNowLabel: terms.paidNow,
    /*
     * Read off the RECORD, never recomputed — the same rule the balance
     * follows, and for the same reason: later payments must not change what a
     * copy already handed over says.
     *
     * `paidBefore` is omitted at zero because "Paid before ₦0.00" is a row
     * that tells somebody nothing had happened yet, which they know.
     */
    ...(document.invoiceTotalMinor === undefined
      ? {}
      : { invoiceTotal: money(document.currency, document.invoiceTotalMinor) }),
    ...(document.paidBeforeMinor === undefined || document.paidBeforeMinor <= 0
      ? {}
      : { paidBefore: money(document.currency, document.paidBeforeMinor) }),
    /*
     * FROZEN AT ISSUE, and read straight off the record.
     *
     * Not recomputed from the ledger here: a receipt recomputed at print time
     * would say something different every time it was opened, as later
     * payments arrived. The customer's copy and the owner's copy would then
     * disagree about a figure neither of them can have changed.
     *
     * `undefined` is a standalone receipt — no debt, so no line. Zero is a
     * debt this payment CLEARED, which says so in words.
     */
    ...(document.balanceAfterMinor === undefined
      ? {}
      : document.balanceAfterMinor <= 0
        ? { paidInFull: terms.paidInFull }
        : { balanceRemaining: money(document.currency, document.balanceAfterMinor) }),
  }
}
