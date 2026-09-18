/**
 * In-memory repositories — what `npm run dev` runs against, and what the
 * domain tests use. Deliberately simple: they exist so the UI can be built and
 * tested before SQLite (Phase 2/3) or Supabase (Phase 5) exist, and so every
 * screen has something to render without a network.
 *
 * They honour the two contract rules for real, not approximately:
 *  · idempotency keys are remembered, so a replayed mutation returns the same
 *    record rather than creating a second one;
 *  · issued documents are rejected for edit, so a caller cannot discover the
 *    immutability rule only once it reaches SQLite.
 */

import {
  type AccountRepository,
  type Company,
  type CompanyRepository,
  type Customer,
  type CustomerRepository,
  type DocumentRecord,
  type DocumentRepository,
  type Expense,
  type ExpenseRepository,
  type ItemRepository,
  type MutationContext,
  type Payment,
  type PaymentRepository,
  type RecurrenceRecord,
  type RecurrenceRepository,
  type Repositories,
  type CreditNoteRecord,
  type CreditNoteRepository,
  type AssetRecord,
  type AssetRepository,
  type LinkTokenRecord,
  type LinkTokenRepository,
  type SavedItem,
  type ShareEvent,
  type ShareEventRepository,
  RepositoryError,
} from '../types'
import {
  type DeletionRequest,
  cancelDeletion,
  requestDeletion,
} from '../../../domain/account/deletion'
import { assertTransition, isDraft, isEvidenceSealed } from '../../../domain/documents/lifecycle'
import { reversalOf } from '../../../domain/payments/ledger'

let counter = 0
const nextId = (prefix: string): string => `${prefix}_${(++counter).toString(36)}`

/**
 * MINTED IDS MUST NOT COLLIDE WITH SEEDED ONES.
 *
 * The counter started at zero and knew nothing about the state it was handed,
 * so the first customer added to a SEEDED store was minted `cus_1` — the id
 * the seed had already given somebody else.
 *
 * What that looked like, walked on a phone: recording a cash payment from
 * "Musa Adamu" produced a receipt made out to Okoro & Sons Ltd, and Musa's
 * balance showed Okoro's ₦1,227,012.50. The name had been stored correctly
 * and every lookup by id then found the wrong person — two customers, one id,
 * and `find` returns whichever comes first.
 *
 * Demo-only: SQLite and Supabase both mint UUIDs, so nothing an account build
 * does can produce this. But the samples app is what anybody judges the
 * product by, and it was attributing money to the wrong customer.
 *
 * Counted past every id already present rather than reset, because the store
 * is a module singleton — two of them in one process (a test file, a preview
 * with a reseed) must not hand out the same id twice either.
 */
function reserveSeededIds(state: MemoryState): void {
  const ids = [
    ...state.customers.map((row) => row.id),
    ...state.documents.map((row) => row.id),
    ...state.payments.map((row) => row.id),
    ...state.items.map((row) => row.id),
    ...state.expenses.map((row) => row.id),
  ]
  for (const id of ids) {
    const suffix = id.slice(id.lastIndexOf('_') + 1)
    const value = Number.parseInt(suffix, 36)
    if (Number.isFinite(value) && value > counter) counter = value
  }
}

/** Remembers what each idempotency key produced, so a retry is a no-op (§M). */
class IdempotencyLog {
  private readonly seen = new Map<string, unknown>()

  once<T>(ctx: MutationContext, produce: () => T): T {
    const existing = this.seen.get(ctx.idempotencyKey)
    if (existing !== undefined) return existing as T
    const created = produce()
    this.seen.set(ctx.idempotencyKey, created)
    return created
  }
}

export interface MemoryState {
  companies: Company[]
  customers: Customer[]
  documents: DocumentRecord[]
  payments: Payment[]
  items: SavedItem[]
  expenses: Expense[]
  shares: ShareEvent[]
  credits: CreditNoteRecord[]
  assets: AssetRecord[]
  linkTokens: LinkTokenRecord[]
  recurrences: RecurrenceRecord[]
  /** Absent until somebody asks to leave. */
  deletion?: DeletionRequest
}

export const emptyState = (): MemoryState => ({
  companies: [],
  customers: [],
  documents: [],
  payments: [],
  items: [],
  expenses: [],
  shares: [],
  credits: [],
  assets: [],
  linkTokens: [],
  recurrences: [],
})

export function createMemoryRepositories(state: MemoryState = emptyState()): Repositories {
  reserveSeededIds(state)
  const log = new IdempotencyLog()
  const scoped = <T extends { companyId: string }>(rows: T[], companyId: string): T[] =>
    rows.filter((r) => r.companyId === companyId)

  const companies: CompanyRepository = {
    async get(companyId) {
      return state.companies.find((c) => c.id === companyId) ?? null
    },
    async update(companyId, patch, ctx) {
      return log.once(ctx, () => {
        const index = state.companies.findIndex((c) => c.id === companyId)
        const current = state.companies[index]
        if (current === undefined) throw new RepositoryError(`No company ${companyId}.`)
        const updated = { ...current, ...patch, id: current.id }
        state.companies[index] = updated
        return updated
      })
    },
  }

  const customers: CustomerRepository = {
    async list(companyId) {
      return scoped(state.customers, companyId)
    },
    async get(companyId, id) {
      return scoped(state.customers, companyId).find((c) => c.id === id) ?? null
    },
    async search(companyId, query) {
      const q = query.trim().toLocaleLowerCase()
      if (q === '') return scoped(state.customers, companyId)
      return scoped(state.customers, companyId).filter((c) =>
        [c.name, c.phone, c.email, c.address]
          .filter((v): v is string => typeof v === 'string')
          .some((v) => v.toLocaleLowerCase().includes(q)),
      )
    },
    async create(customer, ctx) {
      return log.once(ctx, () => {
        const created: Customer = { ...customer, id: nextId('cus') }
        state.customers.push(created)
        return created
      })
    },
    async update(id, patch, ctx) {
      return log.once(ctx, () => {
        const index = state.customers.findIndex((c) => c.id === id)
        const current = state.customers[index]
        if (current === undefined) throw new RepositoryError(`No customer ${id}.`)
        const updated = { ...current, ...patch, id: current.id }
        state.customers[index] = updated
        return updated
      })
    },
  }

  const findDocument = (id: string): { index: number; row: DocumentRecord } => {
    const index = state.documents.findIndex((d) => d.id === id)
    const row = state.documents[index]
    if (row === undefined) throw new RepositoryError(`No document ${id}.`)
      return { index, row }
  }

  const documents: DocumentRepository = {
    async listByType(companyId, type) {
      return scoped(state.documents, companyId).filter((d) => d.type === type)
    },
    async get(companyId, id) {
      return scoped(state.documents, companyId).find((d) => d.id === id) ?? null
    },
    async search(companyId, query) {
      const q = query.trim().toLocaleLowerCase()
      if (q === '') return scoped(state.documents, companyId)
      return scoped(state.documents, companyId).filter((d) =>
        [d.type, d.issuedReference, d.frozenLabels?.printedTitle]
          .filter((v): v is string => typeof v === 'string')
          .some((v) => v.toLocaleLowerCase().includes(q)),
      )
    },
    async createDraft(draft, ctx) {
      return log.once(ctx, () => {
        const created: DocumentRecord = {
          ...draft,
          id: nextId('doc'),
          issuedReference: null,
          frozenLabels: null,
        }
        state.documents.push(created)
        return created
      })
    },
    async updateDraft(id, patch, ctx) {
      return log.once(ctx, () => {
        const { index, row } = findDocument(id)
        if (!isDraft(row.status)) {
          throw new RepositoryError(
            `${row.type} ${id} is issued and immutable — correct it by void, credit note or reissue (v6 §C).`,
          )
        }
        const updated = {
          ...row,
          ...patch,
          id: row.id,
          issuedReference: row.issuedReference,
          frozenLabels: row.frozenLabels,
        }
        state.documents[index] = updated
        return updated
      })
    },
    async attachDeliveryPhoto(id, assetId, ctx) {
      return log.once(ctx, () => {
        const { index, row } = findDocument(id)
        if (isEvidenceSealed(row.type, row.status)) {
          throw new RepositoryError(
            `${row.type} ${id} is already signed for. Delivery evidence cannot be altered once captured (v6 §P).`,
          )
        }
        if (isDraft(row.status)) {
          throw new RepositoryError(
            `${row.type} ${id} has not been issued; there is nothing to be evidence of yet.`,
          )
        }
        const updated: DocumentRecord = { ...row, deliveryPhotoAssetId: assetId }
        state.documents[index] = updated
        return updated
      })
    },
    async signDelivery(id, evidence, ctx) {
      return log.once(ctx, () => {
        const { index, row } = findDocument(id)
        if (isEvidenceSealed(row.type, row.status)) {
          throw new RepositoryError(
            `${row.type} ${id} is already signed for. Delivery evidence cannot be altered once captured (v6 §P).`,
          )
        }
        // The lifecycle has the final say on whether this document can reach
        // delivered at all — a draft cannot, and neither can a void one.
        assertTransition(row.type, row.status, 'delivered')
        const updated: DocumentRecord = {
          ...row,
          ...evidence,
          // One write: the mark, the signer, the moment and the status land
          // together or not at all (§P).
          status: 'delivered',
        }
        state.documents[index] = updated
        return updated
      })
    },
    async issue(id, issued, ctx) {
      return log.once(ctx, () => {
        const { index, row } = findDocument(id)
        assertTransition(row.type, row.status, 'issued')
        const updated: DocumentRecord = {
          ...row,
          status: 'issued',
          issuedReference: issued.reference,
          frozenLabels: issued.frozenLabels,
          totalMinor: issued.totalMinor,
        }
        state.documents[index] = updated
        return updated
      })
    },
    async transition(id, to, ctx) {
      return log.once(ctx, () => {
        const { index, row } = findDocument(id)
        assertTransition(row.type, row.status, to)
        const updated = { ...row, status: to }
        state.documents[index] = updated
        return updated
      })
    },
  }

  const payments: PaymentRepository = {
    async listForCompany(companyId) {
      // A payment is scoped by the customer it belongs to — the ledger type
      // carries no companyId of its own, and duplicating it would give two
      // places to disagree.
      const customerIds = new Set(scoped(state.customers, companyId).map((c) => c.id))
      return state.payments.filter((p) => customerIds.has(p.customerId))
    },
    async listForInvoice(companyId, invoiceId) {
      const owned = scoped(state.documents, companyId).some((d) => d.id === invoiceId)
      if (!owned) return []
      return state.payments.filter((p) =>
        p.allocations.some((a) => a.invoiceId === invoiceId),
      )
    },
    async record(payment, ctx) {
      return log.once(ctx, () => {
        const id = nextId('pay')
        // The allocations arrive built against the caller's local handle — the
        // real id is minted here, so they are re-stamped here too. Left alone,
        // every allocation would name a payment that does not exist: harmless
        // in memory, a broken foreign key the moment this is SQLite (§E).
        const created: Payment = {
          ...payment,
          id,
          allocations: payment.allocations.map((allocation) => ({
            ...allocation,
            id: `${id}:${allocation.invoiceId}`,
            paymentId: id,
          })),
        }
        state.payments.push(created)
        return created
      })
    },
    async reverse(paymentId, ctx) {
      return log.once(ctx, () => {
        const original = state.payments.find((p) => p.id === paymentId)
        if (original === undefined) throw new RepositoryError(`No payment ${paymentId}.`)
        const reversal = reversalOf(original, nextId('pay'), new Date().toISOString())
        state.payments.push(reversal)
        return reversal
      })
    },
  }

  const items: ItemRepository = {
    async list(companyId) {
      return scoped(state.items, companyId)
    },
    async suggest(companyId, prefix) {
      const p = prefix.trim().toLocaleLowerCase()
      if (p === '') return []
      return scoped(state.items, companyId).filter((i) =>
        i.name.toLocaleLowerCase().startsWith(p),
      )
    },
    async remember(item, ctx) {
      return log.once(ctx, () => {
        const existing = state.items.find(
          (i) => i.companyId === item.companyId && i.name.toLocaleLowerCase() === item.name.toLocaleLowerCase(),
        )
        if (existing !== undefined) {
          const updated: SavedItem = {
            ...existing,
            ...item,
            id: existing.id,
            timesUsed: existing.timesUsed + 1,
          }
          state.items[state.items.indexOf(existing)] = updated
          return updated
        }
        const created: SavedItem = { ...item, id: nextId('itm'), timesUsed: 1 }
        state.items.push(created)
        return created
      })
    },
  }

  const expenses: ExpenseRepository = {
    async list(companyId) {
      return scoped(state.expenses, companyId)
    },
    async create(expense, ctx) {
      return log.once(ctx, () => {
        const created: Expense = { ...expense, id: nextId('exp') }
        state.expenses.push(created)
        return created
      })
    },
  }

  const recurrences: RecurrenceRepository = {
    async list(companyId) {
      return scoped(state.recurrences, companyId)
    },
    async start(recurrence, ctx) {
      return log.once(ctx, () => {
        // One schedule per document: switching Repeat on for one that already
        // has a schedule REPLACES it rather than adding a second, and
        // re-starting a stopped one drops `endedOn` — a row that still said it
        // ended while the toggle said it was on would be read by `catchUp` as
        // ended, and quietly produce nothing.
        const index = state.recurrences.findIndex(
          (row) => row.sourceDocumentId === recurrence.sourceDocumentId,
        )
        if (index === -1) state.recurrences.push(recurrence)
        else state.recurrences[index] = recurrence
        return recurrence
      })
    },
    async stop(companyId, sourceDocumentId, on, ctx) {
      return log.once(ctx, () => {
        const index = state.recurrences.findIndex(
          (row) => row.sourceDocumentId === sourceDocumentId && row.companyId === companyId,
        )
        const current = state.recurrences[index]
        if (current === undefined) {
          throw new RepositoryError(`No repeat on document ${sourceDocumentId}.`)
        }
        const stopped: RecurrenceRecord = { ...current, endedOn: on }
        state.recurrences[index] = stopped
        return stopped
      })
    },
  }

  const shares: ShareEventRepository = {
    async list(companyId) {
      return scoped(state.shares, companyId)
    },
    async listForDocument(companyId, documentId) {
      return scoped(state.shares, companyId).filter((event) => event.recordId === documentId)
    },
    async record(event, ctx) {
      // Append-only (§E audit_log): no update, no delete, and a replayed key
      // returns the event already written rather than a second one.
      return log.once(ctx, () => {
        const created: ShareEvent = { ...event, id: nextId('shr') }
        state.shares.push(created)
        return created
      })
    },
  }

  const credits: CreditNoteRepository = {
    async list(companyId) {
      return scoped(state.credits, companyId)
    },
    async listForInvoice(companyId, invoiceId) {
      return scoped(state.credits, companyId).filter((note) => note.invoiceId === invoiceId)
    },
    async issue(note, ctx) {
      // Append-only: an issued credit note is immutable, and correcting one
      // means issuing another (Rule #5).
      return log.once(ctx, () => {
        const created: CreditNoteRecord = { ...note, id: nextId('crn') }
        state.credits.push(created)
        return created
      })
    },
  }

  const linkTokens: LinkTokenRepository = {
    async get(companyId, documentId) {
      return (
        scoped(state.linkTokens, companyId).find((row) => row.documentId === documentId) ?? null
      )
    },
    async mint(token, ctx) {
      return log.once(ctx, () => {
        // One live token per document: a second link would mean two ways in
        // and only one of them revocable (§P).
        const existing = state.linkTokens.findIndex(
          (row) => row.documentId === token.documentId,
        )
        const created: LinkTokenRecord = { ...token }
        if (existing >= 0) state.linkTokens[existing] = created
        else state.linkTokens.push(created)
        return created
      })
    },
  }

  const assets: AssetRepository = {
    async list(companyId) {
      return scoped(state.assets, companyId)
    },
    async get(id) {
      return state.assets.find((asset) => asset.id === id) ?? null
    },
    async store(asset, ctx) {
      // No update, no delete. An asset behind an issued document is evidence
      // (§P) — drawing again makes a new one rather than editing this one.
      return log.once(ctx, () => {
        const created: AssetRecord = { ...asset, id: nextId('ast') }
        state.assets.push(created)
        return created
      })
    },
  }

  /**
   * Ending the account, in memory.
   *
   * The RULES are the domain module's, called here rather than restated: the
   * demo and the deployed app must agree about who may ask and how long the
   * window is, and the only way to be sure is for both to call the same
   * function. The server checks them AGAIN in `0017_account_deletion.sql`,
   * because a rule checked only in the client is a suggestion.
   */
  const account: AccountRepository = {
    async lifecycle(companyId) {
      const request = state.deletion
      return request !== undefined && request.companyId === companyId
        ? { state: 'scheduled', request }
        : { state: 'active' }
    },
    async request(input) {
      const outcome = requestDeletion({
        ...input,
        lifecycle: await account.lifecycle(input.companyId),
        now: new Date(),
      })
      if (outcome.ok) state.deletion = outcome.value
      return outcome
    },
    async cancel(companyId, role) {
      const outcome = cancelDeletion(await account.lifecycle(companyId), role)
      if (outcome.ok) delete state.deletion
      return outcome
    },
  }

  return {
    account,
    companies,
    customers,
    documents,
    recurrences,
    payments,
    items,
    expenses,
    shares,
    credits,
    assets,
    linkTokens,
  }
}
