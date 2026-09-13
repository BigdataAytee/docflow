/**
 * The one place screens get data (§C).
 *
 * Screens import repositories from `src/data/repositories` and nothing else —
 * never a DB client, never Supabase, never SQLite (CLAUDE.md). This provider is
 * the seam: it reads through the repository contracts and hands screens plain
 * arrays, so swapping the in-memory implementation for SQLite or Supabase
 * changes nothing above this file.
 *
 * Two rules it keeps:
 *
 *  · **Every mutation carries an idempotency key.** A retried write is a
 *    no-op (§M), and the key is how each implementation guarantees that.
 *  · **Nothing derived is stored.** Balances, paid/overdue, counts and totals
 *    are computed by the domain layer at read time (Rule #3). This holds
 *    records, not conclusions.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useCompany } from './context'
import type {
  Company,
  Customer,
  DocumentRecord,
  Expense,
  MutationContext,
  Payment,
  SavedItem,
  ShareEvent,
  CreditNoteRecord,
  AssetRecord,
} from '../data/repositories'
import { DOCUMENT_TYPES, type DocumentType } from '../domain/documents/types'
import { type LinkKind, linkFor, mintToken } from '../features/links/token'
import type { FrozenLabels } from '../domain/documents/types'

export interface AppData {
  readonly company: Company | null
  readonly customers: readonly Customer[]
  readonly documents: readonly DocumentRecord[]
  readonly payments: readonly Payment[]
  readonly items: readonly SavedItem[]
  readonly expenses: readonly Expense[]
  readonly shares: readonly ShareEvent[]
  readonly creditNotes: readonly CreditNoteRecord[]
  readonly assets: readonly AssetRecord[]
  /** True until the first load settles. Screens show skeletons, never spinners. */
  readonly loading: boolean
  readonly error: string | null
}

export interface AppActions {
  reload(): Promise<void>
  updateCompany(patch: Partial<Company>): Promise<void>
  addCustomer(customer: Omit<Customer, 'id' | 'companyId'>): Promise<Customer>
  updateCustomer(id: string, patch: Partial<Customer>): Promise<void>
  /**
   * `signatureAssetId` is §G's default signature: it "signs new documents
   * unless you draw a different one", so it is applied once at creation
   * rather than re-applied on every open — otherwise clearing it on one draft
   * would silently come back.
   */
  createDraft(
    type: DocumentType,
    currency: string,
    signatureAssetId?: string,
  ): Promise<DocumentRecord>
  /**
   * A draft created under a key the CALLER derives — a conversion's
   * `conv:<source>:<type>`, a receipt's `rct:<payment>`. §M requires retried
   * creates, conversions and recurrence jobs never to duplicate, and a derived
   * key makes that arithmetic rather than luck.
   */
  createDraftWithKey(
    draft: Omit<DocumentRecord, 'id' | 'companyId' | 'issuedReference' | 'frozenLabels'>,
    idempotencyKey: string,
  ): Promise<DocumentRecord>
  updateDraft(id: string, patch: Partial<DocumentRecord>): Promise<void>
  issue(
    id: string,
    issued: { reference: string; frozenLabels: FrozenLabels; totalMinor: number },
  ): Promise<void>
  transition(id: string, to: string): Promise<void>
  /**
   * §P: "atomic delivered + timestamp". One repository write, so a delivery
   * can never be marked delivered with nobody's signature on it.
   */
  signDelivery(
    id: string,
    evidence: {
      signerName: string
      signerRole?: string
      signedAt: string
      signatureAssetId: string
    },
  ): Promise<void>
  /**
   * `idempotencyKey` is optional and means "this submission": pass a key
   * derived from the gesture and a double tap records one payment, not two
   * (§M). Money is the one place where a retry must never add (Rule #3).
   */
  recordPayment(payment: Omit<Payment, 'id'>, idempotencyKey?: string): Promise<Payment>
  reversePayment(paymentId: string): Promise<void>
  rememberItem(item: Omit<SavedItem, 'id' | 'companyId' | 'timesUsed'>): Promise<void>
  addExpense(expense: Omit<Expense, 'id' | 'companyId'>): Promise<void>
  /** §M: a handoff is recorded; delivery never is. */
  recordShare(event: Omit<ShareEvent, 'id' | 'companyId'>): Promise<void>
  /**
   * Stores an image — a drawn signature, a delivery photo, a receipt photo.
   * Immutable once written, so an issued document's evidence cannot change
   * under it (§P); attaching another makes a NEW asset.
   */
  storeAsset(kind: AssetRecord['kind'], dataUrl: string): Promise<AssetRecord>
  /** §E's "delivery photo asset", captured on an issued delivery (§G, §P). */
  attachDeliveryPhoto(id: string, assetId: string): Promise<void>
  /**
   * §G's copy-link actions. Returns the URL ONCE — the token exists in one
   * place for one moment, and only its hash is kept (§P). Asking again mints
   * a new link and kills the old one, which is also how a link sent by
   * mistake is revoked.
   */
  mintPublicLink(documentId: string, kind: LinkKind, baseUrl: string): Promise<string>
  /** Rule #5's middle correction. Append-only; the invoice is untouched. */
  issueCreditNote(
    note: Omit<CreditNoteRecord, 'id' | 'companyId'>,
    idempotencyKey: string,
  ): Promise<CreditNoteRecord>
}

export type AppStore = AppData & { readonly actions: AppActions }

const AppDataContext = createContext<AppStore | null>(null)

const EMPTY: AppData = {
  company: null,
  customers: [],
  documents: [],
  payments: [],
  items: [],
  expenses: [],
  shares: [],
  creditNotes: [],
  assets: [],
  loading: true,
  error: null,
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { companyId, repositories } = useCompany()
  const [data, setData] = useState<AppData>(EMPTY)

  // A monotonic token, so a slow load that finishes after a newer one cannot
  // overwrite it — the sort of bug that shows up only on a bad connection.
  const generation = useRef(0)

  const load = useCallback(async () => {
    const mine = (generation.current += 1)
    try {
      const [company, customers, payments, items, expenses, shares, creditNotes, assets, ...byType] =
        await Promise.all([
          repositories.companies.get(companyId),
          repositories.customers.list(companyId),
          repositories.payments.listForCompany(companyId),
          repositories.items.list(companyId),
          repositories.expenses.list(companyId),
          repositories.shares.list(companyId),
          repositories.credits.list(companyId),
          repositories.assets.list(companyId),
          ...DOCUMENT_TYPES.map((type) => repositories.documents.listByType(companyId, type)),
        ])
      if (generation.current !== mine) return
      setData({
        company,
        customers,
        documents: byType.flat(),
        payments,
        items,
        expenses,
        shares,
        creditNotes,
        assets,
        loading: false,
        error: null,
      })
    } catch (cause) {
      if (generation.current !== mine) return
      setData((current) => ({
        ...current,
        loading: false,
        error: cause instanceof Error ? cause.message : String(cause),
      }))
    }
  }, [companyId, repositories])

  useEffect(() => {
    void load()
  }, [load])

  const actions = useMemo<AppActions>(() => {
    /**
     * One key per logical operation. Callers that need a retry to collapse
     * onto the same write pass their own key through the patch's own identity
     * — here each user gesture is its own operation.
     */
    const key = (what: string): MutationContext => ({
      idempotencyKey: `${what}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    })

    const after = async <T,>(result: T): Promise<T> => {
      await load()
      return result
    }

    return {
      reload: load,
      async updateCompany(patch) {
        await repositories.companies.update(companyId, patch, key('company'))
        await load()
      },
      async addCustomer(customer) {
        return after(
          await repositories.customers.create({ ...customer, companyId }, key('customer.create')),
        )
      },
      async updateCustomer(id, patch) {
        await repositories.customers.update(id, patch, key('customer.update'))
        await load()
      },
      async createDraft(type, currency, signatureAssetId) {
        return after(
          await repositories.documents.createDraft(
            {
              companyId,
              type,
              status: 'draft',
              currency,
              lineItems: [],
              totalMinor: 0,
              ...(signatureAssetId === undefined ? {} : { signatureAssetId }),
            },
            key('document.create'),
          ),
        )
      },
      async createDraftWithKey(draft, idempotencyKey) {
        return after(
          await repositories.documents.createDraft(
            { ...draft, companyId },
            // The key is the operation's own identity (§M), not a fresh one:
            // the same conversion, or the same payment's receipt, is one
            // document however many times it is asked for.
            { idempotencyKey },
          ),
        )
      },
      async updateDraft(id, patch) {
        await repositories.documents.updateDraft(id, patch, key('document.update'))
        await load()
      },
      async issue(id, issued) {
        await repositories.documents.issue(id, issued, key('document.issue'))
        await load()
      },
      async transition(id, to) {
        await repositories.documents.transition(id, to, key('document.transition'))
        await load()
      },
      async signDelivery(id, evidence) {
        await repositories.documents.signDelivery(id, evidence, key('document.sign'))
        await load()
      },
      async recordPayment(payment, idempotencyKey) {
        return after(
          await repositories.payments.record(
            payment,
            idempotencyKey === undefined
              ? key('payment.record')
              : { idempotencyKey },
          ),
        )
      },
      async reversePayment(paymentId) {
        await repositories.payments.reverse(paymentId, key('payment.reverse'))
        await load()
      },
      async rememberItem(item) {
        await repositories.items.remember({ ...item, companyId }, key('item.remember'))
        await load()
      },
      async addExpense(expense) {
        await repositories.expenses.create({ ...expense, companyId }, key('expense.create'))
        await load()
      },
      async recordShare(event) {
        await repositories.shares.record({ ...event, companyId }, key('share.record'))
        await load()
      },
      async storeAsset(kind, dataUrl) {
        return after(
          await repositories.assets.store(
            { companyId, kind, dataUrl, createdAt: new Date().toISOString() },
            key('asset.store'),
          ),
        )
      },
      async mintPublicLink(documentId, kind, baseUrl) {
        const minted = await mintToken()
        // The URL is built BEFORE anything is stored. Minting replaces the
        // document's live token, so a failure after the write would have
        // killed a link the owner had already sent — and handed them an
        // error instead of a replacement.
        const url = linkFor(baseUrl, kind, minted.token)
        await repositories.linkTokens.mint(
          {
            documentId,
            companyId,
            tokenHash: minted.tokenHash,
            expiresAt: minted.expiresAt,
          },
          key('link.mint'),
        )
        await load()
        // The only moment the secret is in one place: it goes into the URL
        // and is never written down (§P).
        return url
      },
      async attachDeliveryPhoto(id, assetId) {
        await repositories.documents.attachDeliveryPhoto(id, assetId, key('document.photo'))
        await load()
      },
      async issueCreditNote(note, idempotencyKey) {
        return after(
          await repositories.credits.issue({ ...note, companyId }, { idempotencyKey }),
        )
      },
    }
  }, [companyId, repositories, load])

  const value = useMemo<AppStore>(() => ({ ...data, actions }), [data, actions])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppStore {
  const value = useContext(AppDataContext)
  if (value === null) throw new Error('useAppData must be used inside an AppDataProvider.')
  return value
}

/** The documents of one type, which is how every list page asks (§G). */
export function documentsOfType(
  documents: readonly DocumentRecord[],
  type: DocumentType,
): DocumentRecord[] {
  return documents.filter((document) => document.type === type)
}

/** Counts for Home's four tiles, per internal type. */
export function countsByType(
  documents: readonly DocumentRecord[],
): Record<DocumentType, number> {
  const counts = { invoice: 0, quotation: 0, receipt: 0, waybill: 0 }
  for (const document of documents) counts[document.type] += 1
  return counts
}
