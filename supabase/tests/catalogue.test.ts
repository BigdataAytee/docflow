/**
 * `remember_item`, the two columns added in 0011, and the one-token rule —
 * all against real Postgres, because all three are facts about SQL.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, asCompany, connectionString } from './apply'

const ACME = '11111111-1111-1111-1111-111111111111'
const RIVAL = '22222222-2222-2222-2222-222222222222'
const INVOICE = 'dddddddd-0000-0000-0000-000000000001'

let db: Client

const remember = (key: string, item: Record<string, unknown>) =>
  db.query<{ result: Record<string, unknown> }>(
    `select public.remember_item($1, $2::jsonb) as result`,
    [key, JSON.stringify(item)],
  )

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)
  await db.query('set role service_role')
  await db.query(
    `insert into public.companies (id, name, currency, locale_region)
     values ($1, 'Sola Ventures', 'NGN', 'NG'), ($2, 'Rival Traders', 'NGN', 'NG')`,
    [ACME, RIVAL],
  )
  await db.query(
    `insert into public.documents (id, company_id, type, status, currency, total_minor)
     values ($1, $2, 'invoice', 'issued', 'NGN', 50000000)`,
    [INVOICE, ACME],
  )
  await db.query('reset role')
}, 60_000)

afterAll(async () => {
  await db?.end()
})

describe('The catalogue learns from what gets typed (§L2)', () => {
  it('raises the count instead of making a second entry', async () => {
    await asCompany(db, ACME, async () => {
      const first = await remember('itm:1', { name: 'Cement', last_price_minor: 500_000, currency: 'NGN' })
      expect(Number(first.rows[0]!.result.times_used)).toBe(1)

      const again = await remember('itm:2', { name: 'Cement', last_price_minor: 550_000, currency: 'NGN' })
      expect(Number(again.rows[0]!.result.times_used)).toBe(2)
      expect(again.rows[0]!.result.id).toBe(first.rows[0]!.result.id)

      const { rows } = await db.query(`select count(*)::int as n from public.items`)
      expect(rows[0]!.n).toBe(1)
    })
  })

  it('treats "Cement" and "cement" as one item', async () => {
    await asCompany(db, ACME, async () => {
      const first = await remember('case:1', { name: 'Sand' })
      const second = await remember('case:2', { name: 'SAND' })

      // Two rows would split one item's history in two, and the suggestion
      // list would offer both.
      expect(second.rows[0]!.result.id).toBe(first.rows[0]!.result.id)
      // The existing spelling wins: a later lower-case typing must not
      // re-case an entry the owner deliberately wrote.
      expect(second.rows[0]!.result.name).toBe('Sand')
    })
  })

  it('keeps the latest price, and never erases one with a blank', async () => {
    await asCompany(db, ACME, async () => {
      await remember('price:1', { name: 'Gravel', last_price_minor: 100_000, currency: 'NGN' })
      const priced = await remember('price:2', { name: 'Gravel', last_price_minor: 120_000, currency: 'NGN' })
      expect(Number(priced.rows[0]!.result.last_price_minor)).toBe(120_000)

      // Used again with no price this time. The catalogue must still know
      // what it cost (§L2).
      const blank = await remember('price:3', { name: 'Gravel' })
      expect(Number(blank.rows[0]!.result.last_price_minor)).toBe(120_000)
      expect(blank.rows[0]!.result.currency).toBe('NGN')
    })
  })

  it('does not raise the count when the same mutation is replayed (§M)', async () => {
    await asCompany(db, ACME, async () => {
      await remember('replay:1', { name: 'Blocks' })
      const replayed = await remember('replay:1', { name: 'Blocks' })
      // Counted twice, the suggestion order slowly stops reflecting what the
      // owner actually types.
      expect(Number(replayed.rows[0]!.result.times_used)).toBe(1)
    })
  })

  it('keeps two companies catalogues apart, even for the same word', async () => {
    await asCompany(db, ACME, async () => {
      await remember('shared:1', { name: 'Diesel' })
    })
    await asCompany(db, RIVAL, async () => {
      const theirs = await remember('shared:1', { name: 'Diesel' })
      expect(Number(theirs.rows[0]!.result.times_used)).toBe(1)
      expect(theirs.rows[0]!.result.company_id).toBe(RIVAL)
    })
  })

  it('refuses an item with no name', async () => {
    await asCompany(db, ACME, async () => {
      await db.query('savepoint before_blank')
      await expect(remember('blank:1', { name: '   ' })).rejects.toThrow(/needs a name/)
      await db.query('rollback to savepoint before_blank')
    })
  })
})

describe('The columns added in 0011 (§E)', () => {
  it('records which route a share took (§M)', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query(
        `insert into public.audit_log (company_id, action, entity, record_id, channel)
         values ($1, 'shared', 'document', $2, 'clipboard') returning channel`,
        [ACME, INVOICE],
      )
      // A clipboard fallback means the share sheet was not available, so
      // "shared" happened in a materially different way.
      expect(rows[0]!.channel).toBe('clipboard')
    })
  })

  it('gives a credit note amount a currency of its own (Rule #3)', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query(
        `insert into public.credit_notes (company_id, invoice_id, reference, amount_minor, currency)
         values ($1, $2, 'CN-0001', 250000, 'GHS') returning currency, amount_minor`,
        [ACME, INVOICE],
      )
      // Minor units alone are not money: 250000 is ₵2,500.00 or ₦2,500.00
      // depending on a fact the row must record rather than infer.
      expect(rows[0]!.currency).toBe('GHS')
    })
  })

  it('will not accept a credit note without a currency at all', async () => {
    await asCompany(db, ACME, async () => {
      await db.query('savepoint before_nocurrency')
      await expect(
        db.query(
          `insert into public.credit_notes (company_id, invoice_id, reference, amount_minor)
           values ($1, $2, 'CN-0002', 250000)`,
          [ACME, INVOICE],
        ),
      ).rejects.toThrow(/null value in column "currency"/)
      await db.query('rollback to savepoint before_nocurrency')
    })
  })
})

describe('One live link token per document (§P)', () => {
  it('replaces the token rather than adding a second', async () => {
    await db.query('set role service_role')
    await db.query(
      `insert into public.document_signing_tokens (document_id, company_id, token_hash, expires_at, consumed_at)
       values ($1, $2, 'first', now() + interval '14 days', now())`,
      [INVOICE, ACME],
    )
    await db.query(
      `insert into public.document_signing_tokens (document_id, company_id, token_hash, expires_at, consumed_at)
       values ($1, $2, 'second', now() + interval '14 days', null)
       on conflict (document_id) do update
         set token_hash = excluded.token_hash,
             expires_at = excluded.expires_at,
             consumed_at = excluded.consumed_at`,
      [INVOICE, ACME],
    )
    const { rows } = await db.query(
      `select token_hash, consumed_at from public.document_signing_tokens where document_id = $1`,
      [INVOICE],
    )
    await db.query('reset role')

    // One row: a second would mean two ways in and only one of them revocable.
    expect(rows).toHaveLength(1)
    expect(rows[0]!.token_hash).toBe('second')
    // And the new link is alive. A stale consumed stamp carried over would
    // leave the replacement born dead.
    expect(rows[0]!.consumed_at).toBeNull()
  })
})
