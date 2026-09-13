/**
 * The Supabase repositories (§C, §Q Phase 5).
 *
 * These satisfy the same contracts as the in-memory store, so nothing in the
 * UI changes when the app is pointed at a real project — that is the whole
 * reason `src/data/repositories` exists and why no component may import a
 * client (CLAUDE.md).
 *
 * Three things are deliberately NOT re-implemented here:
 *
 *  · **The company boundary.** Not one query filters by `company_id` on a
 *    read of a single row. RLS does it (§P, `0006_rls.sql`), and a second
 *    enforcement point is a second place to be wrong — one that would pass
 *    its own tests while the policy underneath it rotted. `listByType` and
 *    friends still take a `companyId` because the contract does; it is used
 *    where it narrows a LIST, never as the thing standing between two
 *    companies.
 *  · **The lifecycle.** `assertTransition`, `isDraft` and `isEvidenceSealed`
 *    are imported from the domain, exactly as the memory store imports them.
 *    A status rule that lived in SQL could disagree with the one the UI shows.
 *  · **Idempotency.** `mutate.ts` owns it, against the unique index from
 *    `0009_idempotency.sql`.
 *
 * Companies and customers are here; documents in `documents.ts`, payments in
 * `payments.ts`, and the six append-only and catalogue contracts in
 * `catalogue.ts` — split by what makes each one hard rather than by size.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type CompanyRepository,
  type Customer,
  type CustomerRepository,
  type Repositories,
  RepositoryError,
} from '../repositories'
import { type Row, fromCompany, fromCustomer, toCompany, toCustomer } from './rows'
import { currentRow, insertOnce, orThrow } from './mutate'
import { anyColumnLike, searchable } from './search'
import { createDocumentRepository } from './documents'
import { createPaymentRepository } from './payments'
import {
  createAssetRepository,
  createCreditNoteRepository,
  createExpenseRepository,
  createItemRepository,
  createLinkTokenRepository,
  createShareEventRepository,
} from './catalogue'

export function createCompanyRepository(db: SupabaseClient): CompanyRepository {
  return {
    async get(companyId) {
      const found = await db.from('companies').select('*').eq('id', companyId).maybeSingle()
      if (found.error !== null) {
        throw new RepositoryError(`Could not read the company: ${found.error.message}`)
      }
      return found.data === null ? null : toCompany(found.data as Row)
    },

    async update(companyId, patch) {
      // No idempotency key, and none is needed: `companies` holds one row per
      // company, so this is an update to a row that always exists, and
      // replaying the same patch writes the same values. There is nothing a
      // retry could duplicate. (The other tables carry a key because a retried
      // INSERT genuinely can produce two rows — see `0009_idempotency.sql`.)
      return toCompany(
        orThrow(
          `Could not update the company`,
          await db
            .from('companies')
            .update(fromCompany(patch))
            .eq('id', companyId)
            .select()
            .maybeSingle(),
        ),
      )
    },
  }
}

export function createCustomerRepository(db: SupabaseClient): CustomerRepository {
  const list = async (companyId: string, query?: string): Promise<Customer[]> => {
    let request = db.from('customers').select('*').eq('company_id', companyId).order('name')
    if (query !== undefined && query !== '') {
      request = request.or(anyColumnLike(['name', 'phone', 'email', 'address'], query))
    }
    const { data, error } = await request
    if (error !== null) throw new RepositoryError(`Could not list customers: ${error.message}`)
    return (data as Row[]).map(toCustomer)
  }

  return {
    list: (companyId) => list(companyId),

    async get(_companyId, id) {
      const found = await db.from('customers').select('*').eq('id', id).maybeSingle()
      if (found.error !== null) {
        throw new RepositoryError(`Could not read customer ${id}: ${found.error.message}`)
      }
      return found.data === null ? null : toCustomer(found.data as Row)
    },

    async search(companyId, query) {
      const q = searchable(query)
      // An empty search is "show me everything", not "show me nothing" — the
      // same as the memory store, so a cleared search box behaves alike.
      return q === '' ? list(companyId) : list(companyId, q)
    },

    async create(customer, ctx) {
      return toCustomer(
        await insertOnce(db, 'customers', customer.companyId, ctx, fromCustomer(customer)),
      )
    },

    async update(id, patch, ctx) {
      const { row, alreadyApplied } = await currentRow(db, 'customers', id, ctx)
      if (alreadyApplied) return toCustomer(row)
      return toCustomer(
        orThrow(
          `Could not update customer ${id}`,
          await db
            .from('customers')
            .update({ ...fromCustomer(patch), idempotency_key: ctx.idempotencyKey })
            .eq('id', id)
            .select()
            .maybeSingle(),
        ),
      )
    },
  }
}

/**
 * Every repository contract, over Supabase.
 *
 * Now a full `Repositories` rather than a `Pick`: the ten contracts are
 * implemented, so the type no longer has to say which are missing. It said so
 * for two increments because a stub factory would have typechecked, wired
 * cleanly into the app, and lost money the first time someone recorded a
 * payment — "not written yet" belonged in the compiler, not in a comment.
 *
 * What this still does NOT mean: nothing is wired to it. `src/app/store.tsx`
 * builds the in-memory store, and pointing the app at a project needs the
 * secrets and a deploy. None of this has spoken to PostgREST.
 */
export function createSupabaseRepositories(db: SupabaseClient): Repositories {
  return {
    companies: createCompanyRepository(db),
    customers: createCustomerRepository(db),
    documents: createDocumentRepository(db),
    payments: createPaymentRepository(db),
    items: createItemRepository(db),
    expenses: createExpenseRepository(db),
    shares: createShareEventRepository(db),
    credits: createCreditNoteRepository(db),
    assets: createAssetRepository(db),
    linkTokens: createLinkTokenRepository(db),
  }
}
