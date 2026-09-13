/**
 * §Q's Phase 5 gate clause: "a confirmed provider event records exactly one
 * payment" — and §271's "verified, idempotent".
 *
 * Against real Postgres, because every rule under test is a SQL one: the
 * unique index that decides a replay, the default-deny on credentials, and the
 * allocation that must never exceed the money that arrived.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, asCompany, connectionString } from './apply'

const ACME = '11111111-1111-1111-1111-111111111111'
const RIVAL = '22222222-2222-2222-2222-222222222222'
const CUSTOMER = 'aaaaaaaa-0000-0000-0000-000000000001'
const INVOICE = 'dddddddd-0000-0000-0000-000000000001'

let db: Client

/** The edge function's call: service_role, no signed-in user anywhere. */
async function record(
  eventId: string,
  over: Partial<{ amount: number; invoice: string | null; allocate: number | null }> = {},
) {
  await db.query('set role service_role')
  try {
    const { rows } = await db.query<{
      result: { payment: Record<string, unknown>; recorded: boolean }
    }>(
      `select public.record_provider_payment(
         $1, $2, $3, 'NGN', $4, '2026-09-13T10:00:00Z', 'paystack', 'INV-0007', $5, $6
       ) as result`,
      [
        ACME,
        eventId,
        CUSTOMER,
        over.amount ?? 50_000_00,
        over.invoice === undefined ? INVOICE : over.invoice,
        over.allocate ?? null,
      ],
    )
    return rows[0]!.result
  } finally {
    await db.query('reset role')
  }
}

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)
}, 60_000)

beforeEach(async () => {
  await db.query('set role service_role')
  await db.query('delete from public.payment_allocations')
  await db.query('delete from public.payments')
  await db.query('delete from public.payment_provider_credentials')
  await db.query('delete from public.documents')
  await db.query('delete from public.customers')
  await db.query('delete from public.companies')
  await db.query(
    `insert into public.companies (id, name, currency, locale_region)
     values ($1, 'Sola Ventures', 'NGN', 'NG'), ($2, 'Rival Traders', 'NGN', 'NG')`,
    [ACME, RIVAL],
  )
  await db.query(`insert into public.customers (id, company_id, name) values ($1, $2, 'Ade Stores')`, [
    CUSTOMER,
    ACME,
  ])
  await db.query(
    `insert into public.documents (id, company_id, type, status, currency, total_minor)
     values ($1, $2, 'invoice', 'issued', 'NGN', 5000000)`,
    [INVOICE, ACME],
  )
  await db.query('reset role')
})

afterAll(async () => {
  await db?.end()
})

describe('A confirmed provider event records exactly one payment (§Q gate)', () => {
  it('records the payment and what it settled', async () => {
    const result = await record('paystack:302961')
    expect(result.recorded).toBe(true)
    expect(result.payment.source).toBe('provider')
    expect(Number(result.payment.amount_minor)).toBe(50_000_00)

    await db.query('set role service_role')
    const allocations = await db.query('select amount_minor from public.payment_allocations')
    await db.query('reset role')
    expect(allocations.rows.map((r) => Number(r.amount_minor))).toEqual([50_000_00])
  })

  it('records nothing the second time the same event arrives (§M)', async () => {
    const first = await record('paystack:302961')
    const replay = await record('paystack:302961')

    expect(replay.recorded).toBe(false)
    expect(replay.payment.id).toBe(first.payment.id)

    await db.query('set role service_role')
    const counts = await db.query(
      `select (select count(*) from public.payments)::int as payments,
              (select count(*) from public.payment_allocations)::int as allocations`,
    )
    await db.query('reset role')
    // A second allocation would say this money settled twice what it did.
    expect(counts.rows[0]).toEqual({ payments: 1, allocations: 1 })
  })

  it('survives a replay that arrives out of order, or three times', async () => {
    for (const _ of [1, 2, 3]) await record('paystack:302961')
    await db.query('set role service_role')
    const { rows } = await db.query('select count(*)::int as n from public.payments')
    await db.query('reset role')
    expect(rows[0]!.n).toBe(1)
  })

  it('keeps two different events apart', async () => {
    await record('paystack:1')
    await record('paystack:2')
    await db.query('set role service_role')
    const { rows } = await db.query('select count(*)::int as n from public.payments')
    await db.query('reset role')
    expect(rows[0]!.n).toBe(2)
  })

  it('lets two companies use the same provider event id', async () => {
    // The index is per company, and provider ids are only unique within a
    // merchant account. A global one would silently swallow the second
    // company's money.
    await record('paystack:302961')
    await db.query('set role service_role')
    await db.query(
      `select public.record_provider_payment($1, 'paystack:302961', null, 'NGN', 1000,
         '2026-09-13T10:00:00Z', 'paystack', 'ref', null, null)`,
      [RIVAL],
    )
    const { rows } = await db.query('select company_id from public.payments')
    await db.query('reset role')
    expect(new Set(rows.map((r) => r.company_id)).size).toBe(2)
  })
})

describe('Money is never inferred, even from a provider (Rule #3)', () => {
  it('never allocates more than the money that arrived', async () => {
    // The caller proposed settling more than was paid. This is the last word
    // before the money is durable.
    const result = await record('paystack:over', { amount: 10_000, allocate: 90_000 })
    expect(result.recorded).toBe(true)

    await db.query('set role service_role')
    const { rows } = await db.query('select amount_minor from public.payment_allocations')
    await db.query('reset role')
    expect(rows.map((r) => Number(r.amount_minor))).toEqual([10_000])
  })

  it('records a standalone payment when no invoice matched (§K)', async () => {
    // §G: never invent an invoice. Unmatched money is customer credit.
    const result = await record('paystack:standalone', { invoice: null })
    expect(result.recorded).toBe(true)

    await db.query('set role service_role')
    const { rows } = await db.query('select count(*)::int as n from public.payment_allocations')
    await db.query('reset role')
    expect(rows[0]!.n).toBe(0)
  })

  it('refuses an amount of nothing', async () => {
    await expect(record('paystack:zero', { amount: 0 })).rejects.toThrow(/above nothing/)
  })
})

describe('Provider secrets are server-only (§P, §U)', () => {
  beforeEach(async () => {
    await db.query('set role service_role')
    await db.query(
      `insert into public.payment_provider_credentials (company_id, provider, secret)
       values ($1, 'paystack', 'sk_live_secret')`,
      [ACME],
    )
    await db.query('reset role')
  })

  it('hides a company own credentials from its own signed-in client', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query('select * from public.payment_provider_credentials')
      // Not even their own. A merchant secret key can move money; nothing in
      // a browser needs to read it back (CLAUDE.md).
      expect(rows).toEqual([])
    })
  })

  it('refuses a client writing one', async () => {
    await expect(
      asCompany(db, ACME, () =>
        db.query(
          `insert into public.payment_provider_credentials (company_id, provider, secret)
           values ($1, 'paypal', 'mine')`,
          [ACME],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('lets the edge function read exactly one company secret', async () => {
    await db.query('set role service_role')
    const { rows } = await db.query(
      `select secret from public.payment_provider_credentials
        where company_id = $1 and provider = 'paystack'`,
      [ACME],
    )
    await db.query('reset role')
    expect(rows[0]!.secret).toBe('sk_live_secret')
  })
})

describe('The recording function is not reachable by a client (§P)', () => {
  it('refuses a signed-in caller, who could otherwise invent money', async () => {
    await asCompany(db, ACME, async () => {
      await db.query('savepoint before_call')
      await expect(
        db.query(
          `select public.record_provider_payment($1, 'forged', null, 'NGN', 999999,
             now(), 'paystack', 'ref', null, null)`,
          [ACME],
        ),
      ).rejects.toThrow(/permission denied/i)
      await db.query('rollback to savepoint before_call')
    })
  })
})
