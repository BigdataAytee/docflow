/**
 * The SQLite repositories (§C, §Q Phase 4).
 *
 * The implementation the phone runs. It satisfies the same contracts as the
 * in-memory store and passes the same suite — `repositories.test.ts` runs
 * every case against both — so a screen cannot tell which one it has, which is
 * the only reason `npm run dev` on in-memory repositories is evidence about
 * anything at all.
 *
 * Documents live in `documents.ts`; they carry Rule #5 and are long enough to
 * read on their own. Everything else is here, because the remaining ten
 * repositories are variations on three shapes — scoped read, append-only
 * write, upsert — and separating them would hide that.
 */

import {
  type AccountRepository,
  type AssetRepository,
  type Company,
  type CompanyRepository,
  type CreditNoteRepository,
  type CustomerRepository,
  type ExpenseRepository,
  type ItemRepository,
  type LinkTokenRepository,
  type PaymentRepository,
  type Repositories,
  type SavedItem,
  type RecurrenceRecord,
  type RecurrenceRepository,
  type ShareEventRepository,
  RepositoryError,
} from '../repositories/types'
import {
  type DeletionRequest,
  cancelDeletion,
  requestDeletion,
} from '../../domain/account/deletion'
import { reversalOf } from '../../domain/payments/ledger'
import type { SqlDriver, SqlTransaction } from './driver'
import { createDocumentRepository } from './documents'
import { type MutationDeps, mutate, readBackBy } from './mutation'
import {
  assetColumns,
  companyColumns,
  creditNoteColumns,
  customerColumns,
  expenseColumns,
  itemColumns,
  linkTokenColumns,
  allocationColumns,
  paymentColumns,
  shareEventColumns,
  toAsset,
  toAllocation,
  toCompany,
  toCreditNote,
  toCustomer,
  toExpense,
  toItem,
  toLinkToken,
  toPayment,
  toRecurrence,
  toShareEvent,
  recurrenceColumns,
  upsert,
} from './rows'

/**
 * Ids are random, not sequential.
 *
 * §E's tables are keyed by UUID because two phones create records offline and
 * both must be right when they meet (§M). A counter — which is what the
 * in-memory store uses, correctly, because it is one process — would collide
 * the moment a second device existed, and the collision would surface as one
 * owner's invoice overwriting another's.
 */
const randomId = (prefix: string): string => {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}_${uuid.replace(/-/g, '')}`
}

export interface SqliteRepositoriesOptions {
  readonly newId?: (prefix: string) => string
  readonly now?: () => string
}

export function createSqliteRepositories(
  driver: SqlDriver,
  options: SqliteRepositoriesOptions = {},
): Repositories {
  const deps: MutationDeps = {
    driver,
    newId: options.newId ?? randomId,
    now: options.now ?? (() => new Date().toISOString()),
  }
  const run = <T>(
    ctx: Parameters<typeof mutate<T>>[1],
    plan: Parameters<typeof mutate<T>>[2],
    readBack: Parameters<typeof mutate<T>>[3],
  ) => mutate<T>(deps, ctx, plan, readBack)

  /* ------------------------------------------------------------ companies */

  const companyBack = readBackBy('companies', toCompany)

  const companies: CompanyRepository = {
    async get(companyId) {
      const row = await driver.get('select * from companies where id = ?', [companyId])
      return row === null ? null : toCompany(row)
    },
    async update(companyId, patch, ctx) {
      return run<Company>(
        ctx,
        {
          entity: 'company',
          kind: 'update',
          write: async (tx) => {
            const current = await companyBack(tx, companyId)
            if (current === null) throw new RepositoryError(`No company ${companyId}.`)
            const updated: Company = { ...current, ...patch, id: current.id }
            const { sql, params } = upsert('companies', companyColumns(updated))
            await tx.run(sql, params)
            return updated
          },
          recordId: (record) => record.id,
        },
        companyBack,
      )
    },
  }

  /* ------------------------------------------------------------ customers */

  const customerBack = readBackBy('customers', toCustomer)

  const customers: CustomerRepository = {
    async list(companyId) {
      const rows = await driver.all(
        'select * from customers where company_id = ? order by rowid asc',
        [companyId],
      )
      return rows.map(toCustomer)
    },
    async get(companyId, id) {
      const row = await driver.get('select * from customers where company_id = ? and id = ?', [
        companyId,
        id,
      ])
      return row === null ? null : toCustomer(row)
    },
    async search(companyId, query) {
      const q = query.trim().toLocaleLowerCase()
      if (q === '') return customers.list(companyId)
      const like = `%${q}%`
      const rows = await driver.all(
        `select * from customers where company_id = ?
           and (lower(name) like ? or lower(coalesce(phone, '')) like ?
                or lower(coalesce(email, '')) like ? or lower(coalesce(address, '')) like ?)
         order by rowid asc`,
        [companyId, like, like, like, like],
      )
      return rows.map(toCustomer)
    },
    async create(customer, ctx) {
      return run(
        ctx,
        {
          entity: 'customer',
          kind: 'create',
          write: async (tx) => {
            const created = { ...customer, id: deps.newId('cus') }
            const { sql, params } = upsert('customers', customerColumns(created))
            await tx.run(sql, params)
            return created
          },
          recordId: (record) => record.id,
        },
        customerBack,
      )
    },
    async update(id, patch, ctx) {
      return run(
        ctx,
        {
          entity: 'customer',
          kind: 'update',
          write: async (tx) => {
            const current = await customerBack(tx, id)
            if (current === null) throw new RepositoryError(`No customer ${id}.`)
            const updated = { ...current, ...patch, id: current.id }
            const { sql, params } = upsert('customers', customerColumns(updated))
            await tx.run(sql, params)
            return updated
          },
          recordId: (record) => record.id,
        },
        customerBack,
      )
    },
  }

  /* ------------------------------------------------------------- payments */

  /**
   * A payment is read back with its allocations, always.
   *
   * They are two tables and one record. Returning a payment without them would
   * let a caller compute a balance from a payment that looks unallocated, and
   * §K's rule — balances are computed, never stored — means that wrong number
   * would propagate everywhere rather than sit in one stale column.
   */
  const paymentBack = async (tx: SqlTransaction, id: string) => {
    const row = await tx.get('select * from payments where id = ?', [id])
    if (row === null) return null
    const allocations = (
      await tx.all(
        'select * from payment_allocations where payment_id = ? order by position asc',
        [id],
      )
    ).map(toAllocation)
    return toPayment(row, allocations)
  }

  const listPayments = async (where: string, params: readonly string[]) => {
    const rows = await driver.all(`select * from payments ${where} order by rowid asc`, params)
    if (rows.length === 0) return []
    const allocations = await driver.all(
      'select * from payment_allocations order by position asc',
      [],
    )
    const byPayment = new Map<string, ReturnType<typeof toAllocation>[]>()
    for (const row of allocations) {
      const allocation = toAllocation(row)
      const list = byPayment.get(allocation.paymentId) ?? []
      list.push(allocation)
      byPayment.set(allocation.paymentId, list)
    }
    return rows.map((row) => toPayment(row, byPayment.get(String(row['id'])) ?? []))
  }

  const payments: PaymentRepository = {
    async listForCompany(companyId) {
      // Scoped through the customer, because the ledger type carries no
      // company of its own — the same rule the in-memory store follows, and
      // the reason `payments` has no company_id column.
      return listPayments(
        'where customer_id in (select id from customers where company_id = ?)',
        [companyId],
      )
    },
    async listForInvoice(companyId, invoiceId) {
      const owned = await driver.get('select id from documents where company_id = ? and id = ?', [
        companyId,
        invoiceId,
      ])
      if (owned === null) return []
      return listPayments(
        'where id in (select payment_id from payment_allocations where invoice_id = ?)',
        [invoiceId],
      )
    },
    async record(payment, ctx) {
      return run(
        ctx,
        {
          entity: 'payment',
          kind: 'create',
          write: async (tx) => {
            const id = deps.newId('pay')
            // The allocations arrive built against the caller's local handle;
            // the real id is minted here, so they are re-stamped here too.
            // Left alone, every allocation would name a payment that does not
            // exist — a broken foreign key, not a cosmetic one (§E).
            const created = {
              ...payment,
              id,
              allocations: payment.allocations.map((allocation) => ({
                ...allocation,
                id: `${id}:${allocation.invoiceId}`,
                paymentId: id,
              })),
            }
            const row = upsert('payments', paymentColumns(created))
            await tx.run(row.sql, row.params)
            for (const [position, allocation] of created.allocations.entries()) {
              const child = upsert('payment_allocations', allocationColumns(allocation, position))
              await tx.run(child.sql, child.params)
            }
            return created
          },
          recordId: (record) => record.id,
        },
        paymentBack,
      )
    },
    async reverse(paymentId, ctx) {
      return run(
        ctx,
        {
          entity: 'payment',
          kind: 'create',
          write: async (tx) => {
            const original = await paymentBack(tx, paymentId)
            if (original === null) throw new RepositoryError(`No payment ${paymentId}.`)
            // An amendment is reversal + replacement, never an edit (§E). The
            // domain builds the reversal so the pair nets to zero by the same
            // rule the money tests check.
            const reversal = reversalOf(original, deps.newId('pay'), deps.now())
            const row = upsert('payments', paymentColumns(reversal))
            await tx.run(row.sql, row.params)
            for (const [position, allocation] of reversal.allocations.entries()) {
              const child = upsert('payment_allocations', allocationColumns(allocation, position))
              await tx.run(child.sql, child.params)
            }
            return reversal
          },
          recordId: (record) => record.id,
        },
        paymentBack,
      )
    },
  }

  /* ---------------------------------------------------------------- items */

  const itemBack = readBackBy('items', toItem)

  const items: ItemRepository = {
    async list(companyId) {
      const rows = await driver.all('select * from items where company_id = ? order by rowid asc', [
        companyId,
      ])
      return rows.map(toItem)
    },
    async suggest(companyId, prefix) {
      const p = prefix.trim().toLocaleLowerCase()
      if (p === '') return []
      const rows = await driver.all(
        'select * from items where company_id = ? and lower(name) like ? order by times_used desc, rowid asc',
        [companyId, `${p}%`],
      )
      return rows.map(toItem)
    },
    async remember(item, ctx) {
      return run<SavedItem>(
        ctx,
        {
          entity: 'item',
          kind: 'update',
          write: async (tx) => {
            // The catalogue builds itself from what gets typed (§L2): the same
            // name typed again is the same item, used once more — never a
            // second row the owner has to tidy up.
            const existing = await tx.get(
              'select * from items where company_id = ? and lower(name) = ? limit 1',
              [item.companyId, item.name.toLocaleLowerCase()],
            )
            const saved: SavedItem =
              existing === null
                ? { ...item, id: deps.newId('itm'), timesUsed: 1 }
                : { ...toItem(existing), ...item, id: String(existing['id']), timesUsed: Number(existing['times_used']) + 1 }
            const { sql, params } = upsert('items', itemColumns(saved))
            await tx.run(sql, params)
            return saved
          },
          recordId: (record) => record.id,
        },
        itemBack,
      )
    },
  }

  /* ------------------------------------------------------------- expenses */

  const expenseBack = readBackBy('expenses', toExpense)

  const expenses: ExpenseRepository = {
    async list(companyId) {
      const rows = await driver.all(
        'select * from expenses where company_id = ? order by rowid asc',
        [companyId],
      )
      return rows.map(toExpense)
    },
    async create(expense, ctx) {
      return run(
        ctx,
        {
          entity: 'expense',
          kind: 'create',
          write: async (tx) => {
            const created = { ...expense, id: deps.newId('exp') }
            const { sql, params } = upsert('expenses', expenseColumns(created))
            await tx.run(sql, params)
            return created
          },
          recordId: (record) => record.id,
        },
        expenseBack,
      )
    },
  }

  /* ---------------------------------------------------------- recurrences */

  const recurrenceBack = readBackBy('recurrences', toRecurrence, 'source_document_id')

  const recurrences: RecurrenceRepository = {
    async list(companyId) {
      const rows = await driver.all(
        'select * from recurrences where company_id = ? order by source_document_id asc',
        [companyId],
      )
      return rows.map(toRecurrence)
    },
    async start(recurrence, ctx) {
      return run<RecurrenceRecord>(
        ctx,
        {
          entity: 'recurrence',
          recordId: (record) => record.sourceDocumentId,
          kind: 'create',
          write: async (tx) => {
            // An upsert, because switching Repeat on for a document that
            // already has a schedule is the SAME schedule — and re-starting a
            // stopped one has to clear `endedOn`, or the row would say it
            // ended while the toggle said it was on.
            const { sql, params } = upsert('recurrences', recurrenceColumns(recurrence), 'source_document_id')
            await tx.run(sql, params)
            return recurrence
          },
        },
        (tx) => recurrenceBack(tx, recurrence.sourceDocumentId),
      )
    },
    async stop(companyId, sourceDocumentId, on, ctx) {
      return run<RecurrenceRecord>(
        ctx,
        {
          entity: 'recurrence',
          recordId: (record) => record.sourceDocumentId,
          kind: 'update',
          write: async (tx) => {
            const current = await recurrenceBack(tx, sourceDocumentId)
            if (current === null || current.companyId !== companyId) {
              throw new RepositoryError(`No repeat on document ${sourceDocumentId}.`)
            }
            const stopped: RecurrenceRecord = { ...current, endedOn: on }
            const { sql, params } = upsert('recurrences', recurrenceColumns(stopped), 'source_document_id')
            await tx.run(sql, params)
            return stopped
          },
        },
        (tx) => recurrenceBack(tx, sourceDocumentId),
      )
    },
  }

  /* --------------------------------------------------------------- shares */

  const shareBack = readBackBy('share_events', toShareEvent)

  const shares: ShareEventRepository = {
    async list(companyId) {
      const rows = await driver.all(
        'select * from share_events where company_id = ? order by rowid asc',
        [companyId],
      )
      return rows.map(toShareEvent)
    },
    async listForDocument(companyId, documentId) {
      const rows = await driver.all(
        'select * from share_events where company_id = ? and record_id = ? order by rowid asc',
        [companyId, documentId],
      )
      return rows.map(toShareEvent)
    },
    async record(event, ctx) {
      // Append-only (§E audit_log): no update, no delete, and a replayed key
      // returns the event already written rather than a second one.
      return run(
        ctx,
        {
          entity: 'share_event',
          kind: 'create',
          write: async (tx) => {
            const created = { ...event, id: deps.newId('shr') }
            const { sql, params } = upsert('share_events', shareEventColumns(created))
            await tx.run(sql, params)
            return created
          },
          recordId: (record) => record.id,
        },
        shareBack,
      )
    },
  }

  /* --------------------------------------------------------------- credits */

  const creditBack = readBackBy('credit_notes', toCreditNote)

  const credits: CreditNoteRepository = {
    async list(companyId) {
      const rows = await driver.all(
        'select * from credit_notes where company_id = ? order by rowid asc',
        [companyId],
      )
      return rows.map(toCreditNote)
    },
    async listForInvoice(companyId, invoiceId) {
      const rows = await driver.all(
        'select * from credit_notes where company_id = ? and invoice_id = ? order by rowid asc',
        [companyId, invoiceId],
      )
      return rows.map(toCreditNote)
    },
    async issue(note, ctx) {
      // Append-only: an issued credit note is immutable, and correcting one
      // means issuing another (Rule #5).
      return run(
        ctx,
        {
          entity: 'credit_note',
          kind: 'create',
          write: async (tx) => {
            const created = { ...note, id: deps.newId('crn') }
            const { sql, params } = upsert('credit_notes', creditNoteColumns(created))
            await tx.run(sql, params)
            return created
          },
          recordId: (record) => record.id,
        },
        creditBack,
      )
    },
  }

  /* --------------------------------------------------------------- assets */

  const assetBack = readBackBy('assets', toAsset)

  const assets: AssetRepository = {
    async list(companyId) {
      const rows = await driver.all(
        'select * from assets where company_id = ? order by rowid asc',
        [companyId],
      )
      return rows.map(toAsset)
    },
    async get(id) {
      const row = await driver.get('select * from assets where id = ?', [id])
      return row === null ? null : toAsset(row)
    },
    async store(asset, ctx) {
      // No update, no delete. An asset behind an issued document is evidence
      // (§P) — drawing again makes a new one rather than editing this one.
      return run(
        ctx,
        {
          entity: 'asset',
          kind: 'create',
          write: async (tx) => {
            const created = { ...asset, id: deps.newId('ast') }
            const { sql, params } = upsert('assets', assetColumns(created))
            await tx.run(sql, params)
            return created
          },
          recordId: (record) => record.id,
        },
        assetBack,
      )
    },
  }

  /* ----------------------------------------------------------- link tokens */

  const linkTokens: LinkTokenRepository = {
    async get(companyId, documentId) {
      const row = await driver.get(
        'select * from link_tokens where company_id = ? and document_id = ?',
        [companyId, documentId],
      )
      return row === null ? null : toLinkToken(row)
    },
    async mint(token, ctx) {
      // One live token per document: a second link would mean two ways in and
      // only one of them revocable (§P). The PRIMARY KEY on document_id is
      // what makes that structural rather than remembered.
      return run(
        ctx,
        {
          entity: 'document',
          kind: 'update',
          write: async (tx) => {
            const created = { ...token }
            const { sql, params } = upsert(
              'link_tokens',
              linkTokenColumns(created),
              'document_id',
            )
            await tx.run(sql, params)
            return created
          },
          recordId: (record) => record.documentId,
        },
        async (tx, documentId) => {
          const row = await tx.get('select * from link_tokens where document_id = ?', [documentId])
          return row === null ? null : toLinkToken(row)
        },
      )
    },
  }

  /* -------------------------------------------------------------- account */

  /**
   * Ending the account (§S; Apple 5.1.1(v)).
   *
   * The RULES are the domain module's, called rather than restated — the demo,
   * the phone and the server must agree about who may ask and how long the
   * window is, and the only way to be sure is for all three to call the same
   * function. The server checks them AGAIN in `0017_account_deletion.sql`,
   * because a rule checked only on the client is a suggestion.
   */
  const account: AccountRepository = {
    async lifecycle(companyId) {
      const row = await driver.get('select request from account_deletion where company_id = ?', [
        companyId,
      ])
      if (row === null) return { state: 'active' }
      return { state: 'scheduled', request: JSON.parse(String(row['request'])) as DeletionRequest }
    },
    async request(input) {
      const outcome = requestDeletion({
        ...input,
        lifecycle: await account.lifecycle(input.companyId),
        now: new Date(),
      })
      if (outcome.ok) {
        await driver.transaction(async (tx) => {
          await tx.run(
            'insert into account_deletion (company_id, request) values (?, ?) ' +
              'on conflict(company_id) do update set request = excluded.request',
            [input.companyId, JSON.stringify(outcome.value)],
          )
        })
      }
      return outcome
    },
    async cancel(companyId, role) {
      const outcome = cancelDeletion(await account.lifecycle(companyId), role)
      if (outcome.ok) {
        await driver.transaction(async (tx) => {
          await tx.run('delete from account_deletion where company_id = ?', [companyId])
        })
      }
      return outcome
    },
  }

  return {
    account,
    companies,
    customers,
    documents: createDocumentRepository(driver, deps),
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
