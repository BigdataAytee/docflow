/**
 * `record_payment` — the one statement that writes a payment and what it
 * settled (§E, §K, §M).
 *
 * Asserted against real Postgres because everything interesting about it is
 * SQL: whether the pair is genuinely atomic, whether a retry writes a second
 * set of allocations, whether the caller's own RLS still applies inside the
 * function body. None of that is visible from the TypeScript side.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, asCompany, connectionString } from './apply'

const ACME = '11111111-1111-1111-1111-111111111111'
const RIVAL = '22222222-2222-2222-2222-222222222222'
const CUSTOMER = 'aaaaaaaa-0000-0000-0000-000000000001'
const INVOICE = 'dddddddd-0000-0000-0000-000000000001'
const RIVAL_INVOICE = 'dddddddd-0000-0000-0000-000000000002'

let db: Client

const payment = (over: Record<string, unknown> = {}) => ({
  customer_id: CUSTOMER,
  currency: 'NGN',
  amount_minor: 50_000_00,
  paid_at: '2026-09-11T10:00:00Z',
  method: 'bank_transfer',
  ...over,
})

/** Call it the way PostgREST does: as the signed-in user, by name. */
const record = (key: string, p: Record<string, unknown>, allocations: unknown[] = []) =>
  db.query<{ result: { payment: Record<string, unknown>; allocations: Record<string, unknown>[] } }>(
    `select public.record_payment($1, $2::jsonb, $3::jsonb) as result`,
    [key, JSON.stringify(p), JSON.stringify(allocations)],
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
  await db.query(`insert into public.customers (id, company_id, name) values ($1, $2, 'Ade Stores')`, [
    CUSTOMER,
    ACME,
  ])
  await db.query(
    `insert into public.documents (id, company_id, type, status, currency, total_minor) values
       ($1, $3, 'invoice', 'issued', 'NGN', 50000000),
       ($2, $4, 'invoice', 'issued', 'NGN', 9900000)`,
    [INVOICE, RIVAL_INVOICE, ACME, RIVAL],
  )
  await db.query('reset role')
}, 60_000)

afterAll(async () => {
  await db?.end()
})

describe('The payment and what it settled are one write (§E)', () => {
  it('records both, and returns both', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await record('pay:1', payment(), [
        { invoice_id: INVOICE, amount_minor: 30_000_00 },
      ])
      const { payment: written, allocations } = rows[0]!.result

      expect(Number(written.amount_minor)).toBe(50_000_00)
      expect(written.company_id).toBe(ACME)
      expect(allocations).toHaveLength(1)
      expect(allocations[0]!.payment_id).toBe(written.id)
      expect(Number(allocations[0]!.amount_minor)).toBe(30_000_00)
    })
  })

  it('records a standalone payment with no allocation at all (§K)', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await record('pay:standalone', payment())
      expect(rows[0]!.result.allocations).toEqual([])
    })
  })

  it('writes nothing at all when the allocations are refused', async () => {
    await asCompany(db, ACME, async () => {
      // More allocated than arrived: money that settles a debt nobody paid.
      // Behind a savepoint because the raise aborts the surrounding
      // transaction, and the point of this test is what survives it.
      await db.query('savepoint before_refusal')
      await expect(
        record('pay:over', payment(), [{ invoice_id: INVOICE, amount_minor: 60_000_00 }]),
      ).rejects.toThrow(/exceed the payment/)
      await db.query('rollback to savepoint before_refusal')

      // The payment must not survive its own rejected allocations — that is
      // the half-succeed this function exists to make impossible.
      const { rows } = await db.query(
        `select id from public.payments where idempotency_key = 'pay:over'`,
      )
      expect(rows).toEqual([])
    })
  })

  it('allows allocating exactly the amount that arrived', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await record('pay:exact', payment(), [
        { invoice_id: INVOICE, amount_minor: 50_000_00 },
      ])
      expect(rows[0]!.result.allocations).toHaveLength(1)
    })
  })
})

describe('A retried record writes one payment and one set of allocations (§M)', () => {
  it('returns the first payment and does not double what it settled', async () => {
    await asCompany(db, ACME, async () => {
      const first = await record('pay:retry', payment(), [
        { invoice_id: INVOICE, amount_minor: 20_000_00 },
      ])
      const again = await record('pay:retry', payment(), [
        { invoice_id: INVOICE, amount_minor: 20_000_00 },
      ])

      expect(again.rows[0]!.result.payment.id).toBe(first.rows[0]!.result.payment.id)
      // The allocations are read back, not written again. A second set would
      // say this money settled twice what it did.
      expect(again.rows[0]!.result.allocations).toHaveLength(1)

      const { rows } = await db.query(
        `select count(*)::int as n from public.payment_allocations where payment_id = $1`,
        [first.rows[0]!.result.payment.id],
      )
      expect(rows[0]!.n).toBe(1)
    })
  })
})

describe('The function runs as the caller, not above them (§P)', () => {
  /**
   * The reason it is SECURITY INVOKER *and* takes no company argument. A
   * DEFINER function with a `p_company_id` would hand every signed-in user a
   * BYPASSRLS-shaped hole: name any company, and it writes there for you.
   * Read from the caller's claims instead, the attack has nowhere to land —
   * so this asserts the stamped company, not a refusal.
   */
  it('stamps the caller company, with no argument that could say otherwise', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await record('pay:stamped', payment())
      expect(rows[0]!.result.payment.company_id).toBe(ACME)
    })

    await asCompany(db, RIVAL, async () => {
      const { rows } = await record('pay:stamped', payment({ customer_id: null }))
      // The SAME idempotency key, from a different company: two rows, because
      // the index is scoped per company. Neither company can reach the other.
      expect(rows[0]!.result.payment.company_id).toBe(RIVAL)
    })
  })

  it('refuses an allocation against another company invoice', async () => {
    await asCompany(db, ACME, async () => {
      // The invoice is real, but not theirs. The foreign key would accept it;
      // nothing but the policy stands between the two companies here.
      await db.query('savepoint before_cross')
      await expect(
        record('pay:cross', payment(), [{ invoice_id: RIVAL_INVOICE, amount_minor: 1_000_00 }]),
      ).rejects.toThrow(/not yours/)
      await db.query('rollback to savepoint before_cross')

      const { rows } = await db.query(
        `select id from public.payments where idempotency_key = 'pay:cross'`,
      )
      expect(rows).toEqual([])
    })
  })

  it('refuses an allocation against an invoice that does not exist', async () => {
    await asCompany(db, ACME, async () => {
      // Same refusal as a stranger's invoice, and deliberately so: the caller
      // cannot tell the two apart, so a wrong id reveals nothing about whether
      // that document exists somewhere else (§P).
      await db.query('savepoint before_missing')
      await expect(
        record('pay:missing', payment(), [
          { invoice_id: '00000000-0000-0000-0000-000000000009', amount_minor: 1_000_00 },
        ]),
      ).rejects.toThrow(/not yours/)
      await db.query('rollback to savepoint before_missing')
    })
  })

  it('is not callable by an unauthenticated caller at all', async () => {
    await asCompany(db, null, async () => {
      // Refused before it touches a table, because there is no company to
      // write to — clearer than the row-level-security error a bare insert
      // would raise, and it reveals nothing about what exists.
      await expect(record('pay:anon', payment())).rejects.toThrow(/Not signed in/)
    })
  })
})

describe('A payment is reversed once, and never edited (§E)', () => {
  it('refuses a second reversal of the same payment', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await record('pay:original', payment())
      const originalId = rows[0]!.result.payment.id

      await record('rev:1', payment({ reversal_of_id: originalId }))
      await expect(record('rev:2', payment({ reversal_of_id: originalId }))).rejects.toThrow(
        /payments_reversal_unique|duplicate key/i,
      )
    })
  })
})
