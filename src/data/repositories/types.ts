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

export type { Payment, PaymentAllocation } from '../../domain/payments/ledger'
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
}

export class RepositoryError extends Error {}
