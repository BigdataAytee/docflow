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
  type Repositories,
  type CreditNoteRecord,
  type CreditNoteRepository,
  type AssetRecord,
  type AssetRepository,
  type SavedItem,
  type ShareEvent,
  type ShareEventRepository,
  RepositoryError,
} from '../types'
import { assertTransition, isDraft, isEvidenceSealed } from '../../../domain/documents/lifecycle'
import { reversalOf } from '../../../domain/payments/ledger'

let counter = 0
const nextId = (prefix: string): string => `${prefix}_${(++counter).toString(36)}`

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
})

export function createMemoryRepositories(state: MemoryState = emptyState()): Repositories {
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

  return {
    companies,
    customers,
    documents,
    payments,
    items,
    expenses,
    shares,
    credits,
    assets,
  }
}
