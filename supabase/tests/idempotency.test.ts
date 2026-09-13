/**
 * §M's "retried creates never duplicate", as a database constraint.
 *
 * The repositories send `on conflict (company_id, idempotency_key) do nothing`
 * and then read back. Everything rests on the unique index from
 * `0009_idempotency.sql` actually being there and actually being scoped the
 * way the comment claims — and an index is exactly the kind of thing that gets
 * dropped by a later migration without anyone noticing, because nothing fails
 * loudly when it goes. Nothing, that is, except this file.
 *
 * Asserted against real Postgres, with no secrets and no hosted project.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, connectionString } from './apply'

const ACME = '11111111-1111-1111-1111-111111111111'
const RIVAL = '22222222-2222-2222-2222-222222222222'

/** Every table the repositories stamp a key onto (0009). */
const KEYED = [
  'customers',
  'documents',
  'payments',
  'credit_notes',
  'expenses',
  'assets',
  'items',
  'audit_log',
] as const

let db: Client

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
}, 60_000)

afterAll(async () => {
  await db?.end()
})

/** The insert the repositories actually send, in SQL. */
async function insertOnce(company: string, key: string | null, name: string): Promise<number> {
  const { rowCount } = await db.query(
    `insert into public.customers (company_id, name, idempotency_key)
     values ($1, $2, $3)
     on conflict (company_id, idempotency_key) do nothing`,
    [company, name, key],
  )
  return rowCount ?? 0
}

describe('The index that makes a retry a no-op exists (§M)', () => {
  it('covers every table the repositories stamp a key onto', async () => {
    const { rows } = await db.query<{ tablename: string; indexdef: string }>(
      `select tablename, indexdef from pg_indexes
        where schemaname = 'public' and indexdef like '%idempotency_key%'`,
    )
    const byTable = new Map(rows.map((r) => [r.tablename, r.indexdef]))

    for (const table of KEYED) {
      const def = byTable.get(table)
      expect(def, `${table} has no idempotency index`).toBeDefined()
      expect(def, `${table}'s index is not UNIQUE — it would de-duplicate nothing`).toContain(
        'CREATE UNIQUE INDEX',
      )
      expect(def, `${table}'s index is not scoped to a company`).toContain('company_id')
    }
  })
})

describe('A retried create writes one row (§M)', () => {
  it('ignores the second insert and leaves the first row untouched', async () => {
    expect(await insertOnce(ACME, 'cus:okoro', 'Okoro')).toBe(1)
    // The retry carries the same derived key — and, because it is a retry of a
    // request whose response was lost, possibly different-looking data. The
    // first write stands; nothing is overwritten.
    expect(await insertOnce(ACME, 'cus:okoro', 'Okoro (retyped)')).toBe(0)

    const { rows } = await db.query(
      `select name from public.customers where company_id = $1 and idempotency_key = 'cus:okoro'`,
      [ACME],
    )
    expect(rows.map((r) => r.name)).toEqual(['Okoro'])
  })

  it('still separates two genuinely different mutations', async () => {
    expect(await insertOnce(ACME, 'cus:a', 'A')).toBe(1)
    expect(await insertOnce(ACME, 'cus:b', 'B')).toBe(1)
  })

  /**
   * The reason the index is (company_id, idempotency_key) and not the key
   * alone. Keys are DERIVED — `rct:<payment>`, `rec:<doc>:<YYYY-MM>` — so two
   * companies producing the same string is ordinary, not adversarial. Under a
   * global index the second company's write would be silently swallowed: no
   * error, no row, and an invoice that simply never existed.
   */
  it('does not let one company swallow another company write', async () => {
    expect(await insertOnce(ACME, 'shared-key', 'Acme customer')).toBe(1)
    expect(await insertOnce(RIVAL, 'shared-key', 'Rival customer')).toBe(1)

    const { rows } = await db.query(
      `select company_id from public.customers where idempotency_key = 'shared-key'`,
    )
    expect(new Set(rows.map((r) => r.company_id)).size).toBe(2)
  })

  /**
   * Rows written by the edge functions and by migrations carry no key. A
   * unique index treats NULLs as distinct, so they never collide with each
   * other — but that is a default that a later `NULLS NOT DISTINCT` would
   * reverse, turning the second keyless insert into a hard error.
   */
  it('lets any number of keyless rows exist side by side', async () => {
    expect(await insertOnce(ACME, null, 'Walk-in one')).toBe(1)
    expect(await insertOnce(ACME, null, 'Walk-in two')).toBe(1)
  })
})
