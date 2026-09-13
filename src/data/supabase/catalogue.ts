/**
 * The append-only and catalogue repositories over Supabase (§E, §L2, §P).
 *
 * Six contracts that share one shape — a company-scoped list and a single
 * write — grouped here rather than split into six files of twenty lines.
 * What they do NOT share is why the write is once-only, and that difference
 * is the whole content of this file:
 *
 *  · **items** builds itself from what gets typed (§L2), so `remember` is an
 *    upsert on the NAME, not an insert. Saying "cement" twice must raise a
 *    count, not make a second catalogue entry.
 *  · **expenses** are ordinary records; a retry must not double the money out.
 *  · **shares, credits** are append-only by their nature (§E, Rule #5): a
 *    handoff happened, a correction was issued, and nothing later can un-do
 *    either. There is no update and no delete on them anywhere.
 *  · **assets** are immutable because they are evidence (§P). If the image
 *    behind an issued document could be replaced, every PDF already shared
 *    under it would change meaning. Drawing again makes a NEW asset.
 *  · **linkTokens** are the one write that deliberately DESTROYS something:
 *    minting replaces the document's live token, which is also how an owner
 *    revokes a link they sent by mistake.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type AssetRepository,
  type CreditNoteRepository,
  type ExpenseRepository,
  type ItemRepository,
  type LinkTokenRepository,
  type ShareEventRepository,
  RepositoryError,
} from '../repositories'
import {
  type Row,
  fromAsset,
  fromCreditNote,
  fromExpense,
  fromItem,
  fromLinkToken,
  fromShareEvent,
  toAsset,
  toCreditNote,
  toExpense,
  toItem,
  toLinkToken,
  toShareEvent,
} from './rows'
import { insertOnce, orThrow } from './mutate'

/** One company's rows from one table, mapped, or a named failure. */
async function listOf<T>(
  db: SupabaseClient,
  table: string,
  companyId: string,
  map: (row: Row) => T,
  refine?: (request: ReturnType<ReturnType<SupabaseClient['from']>['select']>) => unknown,
): Promise<T[]> {
  const base = db.from(table).select('*').eq('company_id', companyId)
  const { data, error } = (await (refine === undefined ? base : refine(base))) as {
    data: Row[] | null
    error: { message: string } | null
  }
  if (error !== null) throw new RepositoryError(`Could not list ${table}: ${error.message}`)
  return (data ?? []).map(map)
}

export function createItemRepository(db: SupabaseClient): ItemRepository {
  return {
    list: (companyId) =>
      listOf(db, 'items', companyId, toItem, (request) =>
        // Most used first: the catalogue's job is to put the thing being
        // typed within one tap (§L2), and that is the thing typed most.
        request.order('times_used', { ascending: false }).order('name'),
      ),

    async suggest(companyId, prefix) {
      const p = prefix.trim()
      // An empty prefix suggests NOTHING — unlike search, which shows
      // everything. A suggestion list that fills up before a key is pressed
      // is a menu, and §L2 asks for a shortcut.
      if (p === '') return []
      return listOf(db, 'items', companyId, toItem, (request) =>
        request
          // `ilike` with a trailing wildcard only: a prefix match, not a
          // contains. "ce" offers cement, never "office chair".
          .ilike('name', `${p.replace(/[,()\\*%]/g, ' ')}%`)
          .order('times_used', { ascending: false })
          .order('name'),
      )
    },

    async remember(item, ctx) {
      // §L2: the catalogue builds itself from what gets typed. So this is an
      // upsert on the NAME — saying "cement" twice raises a count rather than
      // making a second entry — and the count is incremented in the database
      // rather than read-then-written, so two devices remembering the same
      // item at once cannot each write `times_used = 1`.
      const { data, error } = await db.rpc('remember_item', {
        p_idempotency_key: ctx.idempotencyKey,
        p_item: fromItem(item),
      })
      if (error !== null) {
        throw new RepositoryError(`Could not save the item: ${error.message}`)
      }
      return toItem(data as Row)
    },
  }
}

export function createExpenseRepository(db: SupabaseClient): ExpenseRepository {
  return {
    list: (companyId) =>
      listOf(db, 'expenses', companyId, toExpense, (request) =>
        request.order('spent_on', { ascending: false }).order('id', { ascending: false }),
      ),

    async create(expense, ctx) {
      return toExpense(await insertOnce(db, 'expenses', expense.companyId, ctx, fromExpense(expense)))
    },
  }
}

export function createShareEventRepository(db: SupabaseClient): ShareEventRepository {
  const order = (request: { order: (column: string, options: object) => unknown }) =>
    request.order('at', { ascending: false })

  return {
    list: (companyId) =>
      listOf(db, 'audit_log', companyId, toShareEvent, (request) =>
        // Only the share actions. `audit_log` carries every action a company
        // takes, and a share list that quietly included issues and voids
        // would be a different thing than it says it is.
        order(request.in('action', ['shared', 'share_dismissed', 'share_failed'])),
      ),

    listForDocument: (companyId, documentId) =>
      listOf(db, 'audit_log', companyId, toShareEvent, (request) =>
        order(
          request
            .in('action', ['shared', 'share_dismissed', 'share_failed'])
            .eq('record_id', documentId),
        ),
      ),

    async record(event, ctx) {
      return toShareEvent(
        await insertOnce(db, 'audit_log', event.companyId, ctx, fromShareEvent(event)),
      )
    },
  }
}

export function createCreditNoteRepository(db: SupabaseClient): CreditNoteRepository {
  return {
    list: (companyId) =>
      listOf(db, 'credit_notes', companyId, toCreditNote, (request) =>
        request.order('issued_at', { ascending: false }).order('id', { ascending: false }),
      ),

    listForInvoice: (companyId, invoiceId) =>
      listOf(db, 'credit_notes', companyId, toCreditNote, (request) =>
        request.eq('invoice_id', invoiceId).order('issued_at', { ascending: false }),
      ),

    async issue(note, ctx) {
      return toCreditNote(
        await insertOnce(db, 'credit_notes', note.companyId, ctx, fromCreditNote(note)),
      )
    },
  }
}

export function createAssetRepository(db: SupabaseClient): AssetRepository {
  return {
    list: (companyId) =>
      listOf(db, 'assets', companyId, toAsset, (request) =>
        request.order('created_at', { ascending: false }),
      ),

    async get(id) {
      // By id alone, and no company filter: RLS scopes it (§P), and an asset
      // is fetched by a document that already named it.
      const found = await db.from('assets').select('*').eq('id', id).maybeSingle()
      if (found.error !== null) {
        throw new RepositoryError(`Could not read asset ${id}: ${found.error.message}`)
      }
      return found.data === null ? null : toAsset(found.data as Row)
    },

    async store(asset, ctx) {
      // No update and no delete anywhere in this repository, and that is not
      // tidiness: a signature behind an issued document is evidence (§P).
      return toAsset(await insertOnce(db, 'assets', asset.companyId, ctx, fromAsset(asset)))
    },
  }
}

export function createLinkTokenRepository(db: SupabaseClient): LinkTokenRepository {
  return {
    async get(_companyId, documentId) {
      const found = await db
        .from('document_signing_tokens')
        .select('*')
        .eq('document_id', documentId)
        .maybeSingle()
      if (found.error !== null) {
        throw new RepositoryError(`Could not read the link token: ${found.error.message}`)
      }
      return found.data === null ? null : toLinkToken(found.data as Row)
    },

    async mint(token) {
      // One live token per document, enforced by the PRIMARY KEY: the table is
      // keyed on `document_id`, so an upsert replaces rather than adds. A
      // second row would mean two ways in and only one of them revocable (§P).
      //
      // Replacing also resets `consumed_at` to null, which is the point —
      // this IS how an owner revokes a link they sent by mistake, and a
      // stale consumed stamp would leave the new link born dead.
      //
      // No idempotency key: the table has none, and needs none. Minting is
      // idempotent in the only sense that matters here — the document ends up
      // with exactly one live token whether this runs once or five times. A
      // key would have to make a REPLAY a no-op, which is precisely wrong:
      // each mint is a deliberate revocation of the last.
      return toLinkToken(
        orThrow(
          'Could not mint the link token',
          await db
            .from('document_signing_tokens')
            .upsert({ ...fromLinkToken(token), consumed_at: null }, { onConflict: 'document_id' })
            .select()
            .maybeSingle(),
        ),
      )
    },
  }
}
