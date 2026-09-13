/**
 * The UI-facing data contracts (§C).
 *
 * UI components import from here and nowhere else — never a DB client, never
 * Supabase, never SQLite directly (CLAUDE.md; enforced by the
 * `no-restricted-imports` rule). Three implementations satisfy these:
 * in-memory (here, for the web dev server and tests), SQLite (Phase 2/3) and
 * Supabase (Phase 5).
 *
 * Two rules shape every signature below:
 *  · Derived state is never a parameter. Balances, paid/overdue and expired are
 *    computed at read time from the ledger, so nothing here accepts them.
 *  · Mutations carry an idempotency key. A retried upload must not duplicate a
 *    record (§M), and the key is how each implementation guarantees that.
 */

import type { DocumentType, FrozenLabels, LineItem } from '../../domain/documents/types'
import type { Money } from '../../domain/money/money'
import type { Payment } from '../../domain/payments/ledger'
import type { ShareEvent } from '../../share/events'
import type { CreditNoteRecord } from '../../features/credits/issue'

export type { Payment, PaymentAllocation } from '../../domain/payments/ledger'
export type { ShareEvent, ShareAction } from '../../share/events'
export type { CreditNoteRecord } from '../../features/credits/issue'
export type { Money } from '../../domain/money/money'
export type { DocumentType, FrozenLabels, LineItem } from '../../domain/documents/types'

export interface Company {
  readonly id: string
  readonly name: string
  readonly localeRegion: string
  readonly localeLanguage: string
  readonly labelOverrides: Partial<Record<DocumentType, string>>
  readonly currency: string
  readonly numberingPrefixes: Partial<Record<DocumentType, string>>
  readonly bankFields: Record<string, string>
  readonly enabledPaymentMethods: readonly string[]
  /**
   * The rest of §E's `companies` row: branding, the tax defaults and the
   * saved signature. These were missing while the screens that own them
   * took their values as props; a Settings screen with nowhere to save is
   * not a setting, so they live here now.
   *
   * Rates are PARTS PER MILLION (§K) — 7.5% is 75_000 — so a rate is an
   * integer and never a float, the same rule that governs amounts (Rule #3).
   */
  readonly brandColour?: string
  readonly nameStyle?: 'classic' | 'serif' | 'stacked' | 'ruled' | 'monogram'
  readonly logoSize?: 'S' | 'M' | 'L'
  readonly logoAssetId?: string
  readonly taxRatePpm?: number
  readonly whtRatePpm?: number
  /**
   * `null` clears it, and an absent key means unchanged. A patch carrying
   * `undefined` cannot express "the owner removed this" — the key just goes
   * missing — and sync would then restore a default nobody wanted (§M).
   */
  readonly defaultSignatureAssetId?: string | null
  /** §G validates "the signature requirement" at issue. */
  readonly signatureRequired?: boolean
}

export interface Customer {
  readonly id: string
  readonly companyId: string
  readonly kind: 'company' | 'person'
  readonly name: string
  readonly phone?: string
  readonly email?: string
  readonly address?: string
  readonly labels: readonly string[]
  /** Never printed (§G). */
  readonly privateNote?: string
}

export interface DocumentRecord {
  readonly id: string
  readonly companyId: string
  readonly type: DocumentType
  readonly status: string
  readonly customerId?: string
  readonly currency: string
  readonly lineItems: readonly LineItem[]
  readonly issueDate?: string
  readonly dueDate?: string
  readonly validUntil?: string
  /**
   * §E `converted_from_id`. The link lives on the NEW document only: §G says
   * originals are never altered, and Rule #5 froze the one it came from — so
   * the forward direction (`converted_to_id`) is a READ over the documents
   * rather than a write back. See `src/features/documents/convert.ts`.
   */
  readonly convertedFromId?: string
  /**
   * Receipts only: the payment this receipt is evidence of (§G, §K). A receipt
   * without one cannot be issued — `issueRequirements` says so — which is what
   * stops a receipt ever being the thing that records money.
   */
  readonly paymentId?: string
  /** §E `related_invoice_id`: the invoice a receipt's payment settled, if any. */
  readonly linkedInvoiceId?: string
  /**
   * §G's "duplicate as Rev 2": the quotation this one revises.
   *
   * The link lives on the NEW document, like `convertedFromId`, because the
   * original is never altered (§G) and Rule #5 froze it. "This one was
   * replaced" is derived by looking for a document carrying its id.
   */
  readonly supersedesId?: string
  /**
   * The signature printed at the foot of this document (§I). An asset id, not
   * the bytes: the same drawn signature signs many documents, and an asset is
   * immutable, so an issued document's mark cannot change under it (Rule #5).
   */
  readonly signatureAssetId?: string
  /** §E's waybill columns. Deliveries only; a delivery carries no money (§V). */
  readonly deliveryAddress?: string
  readonly driverName?: string
  readonly vehicleNumber?: string
  readonly dispatchDate?: string
  /**
   * Who took delivery, and when (§E `signer_name`, `signer_role`, `signed_at`).
   * Written once, with the transition to delivered, and sealed after —
   * `isEvidenceSealed` refuses any later edit (§P).
   */
  readonly signerName?: string
  readonly signerRole?: string
  readonly signedAt?: string
  /**
   * §E's "delivery photo asset" — the goods at the gate. Part of the same
   * evidence as the signature, so it seals when the delivery does (§P).
   */
  readonly deliveryPhotoAssetId?: string
  /** Both null until issue, then frozen forever (§M). */
  readonly issuedReference: string | null
  readonly frozenLabels: FrozenLabels | null
  readonly totalMinor: number
}

export interface SavedItem {
  readonly id: string
  readonly companyId: string
  readonly name: string
  readonly lastPrice?: Money
  readonly unit?: string
  readonly timesUsed: number
}

export interface Expense {
  readonly id: string
  readonly companyId: string
  readonly description: string
  readonly category?: string
  readonly amount: Money
  readonly spentOn: string
  /**
   * §E's "photo asset" on an expense. §G lets the receipt photo stand in for
   * the description, so without this an expense saved as a photo alone would
   * store neither — the record could not hold the one thing it had.
   */
  readonly photoAssetId?: string
}

/** Every mutation carries one, so a retry is a no-op (§M). */
export interface MutationContext {
  readonly idempotencyKey: string
  readonly actorId?: string
  readonly deviceId?: string
}

export interface CompanyRepository {
  get(companyId: string): Promise<Company | null>
  update(companyId: string, patch: Partial<Company>, ctx: MutationContext): Promise<Company>
}

export interface CustomerRepository {
  list(companyId: string): Promise<Customer[]>
  get(companyId: string, id: string): Promise<Customer | null>
  search(companyId: string, query: string): Promise<Customer[]>
  create(customer: Omit<Customer, 'id'>, ctx: MutationContext): Promise<Customer>
  update(id: string, patch: Partial<Customer>, ctx: MutationContext): Promise<Customer>
}

export interface DocumentRepository {
  listByType(companyId: string, type: DocumentType): Promise<DocumentRecord[]>
  get(companyId: string, id: string): Promise<DocumentRecord | null>
  /** Matches the internal type, the current label and the frozen label (§D.3). */
  search(companyId: string, query: string): Promise<DocumentRecord[]>
  createDraft(
    draft: Omit<DocumentRecord, 'id' | 'issuedReference' | 'frozenLabels'>,
    ctx: MutationContext,
  ): Promise<DocumentRecord>
  /** Drafts only. An issued document is immutable (Rule #5). */
  updateDraft(id: string, patch: Partial<DocumentRecord>, ctx: MutationContext): Promise<DocumentRecord>
  /** Freezes reference and labels together, once (§M). */
  issue(
    id: string,
    issued: { reference: string; frozenLabels: FrozenLabels; totalMinor: number },
    ctx: MutationContext,
  ): Promise<DocumentRecord>
  transition(id: string, to: string, ctx: MutationContext): Promise<DocumentRecord>
  /**
   * §E's "delivery photo asset", on an issued delivery.
   *
   * Not `updateDraft`: an issued document refuses that, and rightly — but a
   * delivery photo is evidence being CAPTURED rather than a document being
   * edited, the same as the signature. Refuses a delivery whose evidence is
   * sealed, so a photo can never be added to change what a signed record
   * says happened (§P).
   */
  attachDeliveryPhoto(
    id: string,
    assetId: string,
    ctx: MutationContext,
  ): Promise<DocumentRecord>
  /**
   * Delivery evidence and the transition to delivered, in ONE write (§P:
   * "atomic delivered + timestamp").
   *
   * Not `updateDraft` + `transition`: an issued document refuses the first,
   * and two writes can half-succeed — leaving a delivery marked delivered
   * with nobody's signature on it, or a signature on a document that still
   * says it is in transit. Neither is a state anyone could correct, because
   * delivered is terminal and its evidence is sealed.
   *
   * Refuses a document whose evidence is already sealed: a signed delivery
   * cannot be re-signed, by this device or by a later link use (§P).
   */
  signDelivery(
    id: string,
    evidence: {
      signerName: string
      signerRole?: string
      signedAt: string
      signatureAssetId: string
    },
    ctx: MutationContext,
  ): Promise<DocumentRecord>
}

export interface PaymentRepository {
  listForCompany(companyId: string): Promise<Payment[]>
  listForInvoice(companyId: string, invoiceId: string): Promise<Payment[]>
  /** Records once. A replayed key returns the existing record unchanged. */
  record(payment: Omit<Payment, 'id'>, ctx: MutationContext): Promise<Payment>
  /** Amendments are reversal + replacement, never an edit (§E). */
  reverse(paymentId: string, ctx: MutationContext): Promise<Payment>
}

export interface ItemRepository {
  list(companyId: string): Promise<SavedItem[]>
  suggest(companyId: string, prefix: string): Promise<SavedItem[]>
  /** The catalogue builds itself from what gets typed (§L2). */
  remember(item: Omit<SavedItem, 'id' | 'timesUsed'>, ctx: MutationContext): Promise<SavedItem>
}

/**
 * Credit notes (§E `credit_notes`, Rule #5).
 *
 * Append-only for the same reason a payment is: a credit note is the record of
 * a correction that was made, and an issued one is immutable. Correcting a
 * credit note means issuing another, never editing this one.
 */
export interface CreditNoteRepository {
  list(companyId: string): Promise<CreditNoteRecord[]>
  listForInvoice(companyId: string, invoiceId: string): Promise<CreditNoteRecord[]>
  /** Records once. A replayed key returns the existing note unchanged (§M). */
  issue(note: Omit<CreditNoteRecord, 'id'>, ctx: MutationContext): Promise<CreditNoteRecord>
}

/**
 * Sharing events (§M, §E `audit_log`).
 *
 * Append-only, like the table it maps onto: a handoff happened, and nothing
 * later can un-happen it. There is no update and no delete.
 */
export interface ShareEventRepository {
  list(companyId: string): Promise<ShareEvent[]>
  listForDocument(companyId: string, documentId: string): Promise<ShareEvent[]>
  /** Records once. A replayed key returns the existing event unchanged (§M). */
  record(event: Omit<ShareEvent, 'id'>, ctx: MutationContext): Promise<ShareEvent>
}

/**
 * A stored image — today a drawn signature, later a logo or a delivery photo
 * (§E's "asset id" columns).
 *
 * **Immutable once written.** There is no update and no delete, and that is
 * not tidiness: a signature is evidence (§P). If the asset behind an issued
 * document could be replaced, every PDF already shared under it would change
 * meaning retroactively, and Rule #5 would hold for the words on a document
 * but not for the mark at the bottom of it. Drawing again makes a NEW asset.
 *
 * The bytes are held as a data URL rather than a blob so that one shape works
 * against SQLite, Supabase storage and the in-memory store alike, and so a
 * document stays openable offline with nothing to fetch (§M).
 */
export interface AssetRecord {
  readonly id: string
  readonly companyId: string
  /** What this image is. A delivery photo and a signature seal alike (§P). */
  readonly kind: 'signature' | 'delivery_photo' | 'expense_photo'
  /** A `data:` URL. Never a remote one — §M: nothing needed to open a saved document touches a CDN. */
  readonly dataUrl: string
  readonly createdAt: string
}

export interface AssetRepository {
  list(companyId: string): Promise<AssetRecord[]>
  get(id: string): Promise<AssetRecord | null>
  /** Stores once. A replayed key returns the existing asset unchanged (§M). */
  store(asset: Omit<AssetRecord, 'id'>, ctx: MutationContext): Promise<AssetRecord>
}

/**
 * The public-link tokens (§P, §E `document_signing_tokens`).
 *
 * Only the HASH is stored — never the token — so a leaked row cannot open a
 * link, and the table has no client policy at all (§P: "separate from general
 * document reads"). One live token per document: minting another replaces it,
 * which is also how an owner revokes a link they sent by mistake.
 */
export interface LinkTokenRecord {
  readonly documentId: string
  readonly companyId: string
  readonly tokenHash: string
  readonly expiresAt: string
  readonly consumedAt?: string
}

export interface LinkTokenRepository {
  /** The live token for a document, if there is one. Never the secret itself. */
  get(companyId: string, documentId: string): Promise<LinkTokenRecord | null>
  /** Replaces any existing token for this document — the old link dies (§P). */
  mint(token: Omit<LinkTokenRecord, 'consumedAt'>, ctx: MutationContext): Promise<LinkTokenRecord>
}

export interface ExpenseRepository {
  list(companyId: string): Promise<Expense[]>
  create(expense: Omit<Expense, 'id'>, ctx: MutationContext): Promise<Expense>
}

export interface Repositories {
  readonly companies: CompanyRepository
  readonly customers: CustomerRepository
  readonly documents: DocumentRepository
  readonly payments: PaymentRepository
  readonly items: ItemRepository
  readonly expenses: ExpenseRepository
  readonly shares: ShareEventRepository
  readonly credits: CreditNoteRepository
  readonly assets: AssetRepository
  readonly linkTokens: LinkTokenRepository
}

export class RepositoryError extends Error {}
