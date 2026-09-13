/**
 * The Phase 1 gate (§Q): "two seeded companies cannot read or write each
 * other". Blocking in CI against a Postgres service container — the hosted
 * Supabase project is deliberately not involved, so the suite has no secrets,
 * no network and nothing to go stale.
 *
 * It also guards the FORCE regression: ENABLE alone exempts the table owner,
 * which would let this very suite pass while owner-privileged code read across
 * companies. Every table is asserted ENABLE *and* FORCE, so a future migration
 * adding a table cannot quietly opt out.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, asCompany, connectionString } from './apply'

const ACME = '11111111-1111-1111-1111-111111111111'
const RIVAL = '22222222-2222-2222-2222-222222222222'

let db: Client

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)

  // Two companies, seeded as the owner (RLS forced, so seed via service_role).
  await db.query('set role service_role')
  await db.query(
    `insert into public.companies (id, name, currency, locale_region)
     values ($1, 'Dynamic Renaissance', 'NGN', 'NG'), ($2, 'Rival Traders', 'NGN', 'NG')`,
    [ACME, RIVAL],
  )
  await db.query(
    `insert into public.customers (id, company_id, name) values
       ('aaaaaaaa-0000-0000-0000-000000000001', $1, 'Okoro & Sons'),
       ('bbbbbbbb-0000-0000-0000-000000000001', $2, 'Rival Customer')`,
    [ACME, RIVAL],
  )
  await db.query(
    `insert into public.documents (id, company_id, type, status, currency, total_minor) values
       ('dddddddd-0000-0000-0000-000000000001', $1, 'invoice', 'issued', 'NGN', 14500000),
       ('dddddddd-0000-0000-0000-000000000002', $2, 'invoice', 'issued', 'NGN', 9900000)`,
    [ACME, RIVAL],
  )
  await db.query(
    `insert into public.entitlements (company_id, plan) values ($1, 'free'), ($2, 'pro')`,
    [ACME, RIVAL],
  )
  await db.query('reset role')
}, 60_000)

afterAll(async () => {
  await db?.end()
})

describe('RLS is enabled AND forced on every table (§P)', () => {
  it('leaves no table in public without both', async () => {
    const { rows } = await db.query<{ table: string; enabled: boolean; forced: boolean }>(
      `select c.relname as table, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by c.relname`,
    )

    expect(rows.length).toBeGreaterThan(0)
    const missing = rows.filter((r) => !r.enabled || !r.forced)
    expect(
      missing.map((r) => `${r.table} (enabled=${r.enabled}, forced=${r.forced})`),
    ).toEqual([])
  })

  it('covers every §E table the client touches', async () => {
    const { rows } = await db.query<{ table: string }>(
      `select c.relname as table from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`,
    )
    const tables = rows.map((r) => r.table)
    for (const expected of [
      'companies', 'users', 'customers', 'documents', 'payments',
      'payment_allocations', 'credit_notes', 'expenses', 'assets', 'items',
      'logo_projects', 'logo_concepts', 'subscriptions', 'entitlements',
      'audit_log', 'counters', 'numbering_reservations',
      'document_signing_tokens',
    ]) {
      expect(tables, `missing table ${expected}`).toContain(expected)
    }
  })
})

describe('Every table is reachable at all (§P)', () => {
  /**
   * `grant select, insert, update, delete on all tables in schema public` in
   * 0006 is a SNAPSHOT, not a standing rule: it grants on the tables that
   * exist when it runs. A table added by a later migration gets no grant, and
   * the failure is invisible here — RLS is enabled and forced, every policy
   * reads correctly, and PostgREST still answers "permission denied for
   * table". The policies would be perfect and the table unusable.
   *
   * Asserted rather than remembered, because the next person to add a table
   * will not have read 0006.
   */
  it('grants the signed-in role access to every table, including ones added later', async () => {
    const { rows } = await db.query<{ table: string }>(
      `select c.relname as table
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and not has_table_privilege('authenticated', c.oid, 'SELECT')
        order by c.relname`,
    )
    expect(rows.map((r) => r.table)).toEqual([])
  })
})

describe('Two seeded companies cannot read each other (§Q gate)', () => {
  it('shows a company only its own rows', async () => {
    await asCompany(db, ACME, async () => {
      const customers = await db.query('select name from public.customers')
      expect(customers.rows.map((r) => r.name)).toEqual(['Okoro & Sons'])

      const documents = await db.query('select total_minor from public.documents')
      expect(documents.rows.map((r) => Number(r.total_minor))).toEqual([14500000])
    })
  })

  it('returns nothing when reaching for the other company by id', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query('select * from public.documents where company_id = $1', [
        RIVAL,
      ])
      expect(rows).toEqual([])
    })
  })

  /**
   * PERMANENT REGRESSION TEST — do not delete.
   *
   * current_company_id() once cast the claims GUC straight to json, and
   * ''::json raises rather than returning null, so an unauthenticated caller
   * got a database error instead of an empty result. Every claims shape a
   * caller can actually arrive with is pinned here.
   */
  it('denies an unauthenticated caller everything, for every empty-claims shape', async () => {
    const shapes: [string, string | null][] = [
      ['empty string', ''],
      ['empty json object', '{}'],
      ['null company_id', '{"company_id":null}'],
      ['blank company_id', '{"company_id":""}'],
      ['claims never set', null],
    ]

    for (const [name, claims] of shapes) {
      await db.query('begin')
      try {
        await db.query('set local role authenticated')
        if (claims !== null) {
          await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
        }
        for (const table of ['companies', 'customers', 'documents', 'entitlements']) {
          const { rows } = await db.query(`select * from public.${table}`)
          expect(rows, `${table} leaked with ${name}`).toEqual([])
        }
      } finally {
        await db.query('rollback')
      }
    }
  })
})

describe('What FORCE does NOT protect against', () => {
  /**
   * TODO(Phase 7) — service-role penetration checks, tested separately.
   *
   * FORCE closes the table-owner exemption. It does nothing about BYPASSRLS:
   * service_role sees and writes everything by design, because the edge
   * functions need to. So the whole two-company boundary proven above rests on
   * the service key never reaching a client.
   *
   * That means a leaked service key is a total cross-company compromise, and
   * no test in this file would notice. §Q Phase 7 owns it: "scripted
   * permission/RLS penetration checks run as wrong user, wrong role and
   * revoked device". Those must additionally assert that no client bundle,
   * log line, sync payload or edge-function response ever carries the service
   * key — which is a build-and-deploy check, not a SQL one.
   *
   * This test exists so the limitation is executable rather than a comment
   * someone can skim past: it asserts the bypass is real and expected.
   */
  it('service_role bypasses every policy — by design, and the reason Phase 7 exists', async () => {
    await db.query('set role service_role')
    const { rows } = await db.query('select company_id from public.customers')
    await db.query('reset role')

    // Both companies, from one connection, with no claims set at all.
    expect(new Set(rows.map((r) => r.company_id)).size).toBe(2)
  })
})

describe('Two seeded companies cannot write each other (§Q gate)', () => {
  it('rejects an insert carrying the other company id', async () => {
    await expect(
      asCompany(db, ACME, () =>
        db.query(
          `insert into public.customers (company_id, name) values ($1, 'Smuggled')`,
          [RIVAL],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('cannot move its own row into the other company', async () => {
    await expect(
      asCompany(db, ACME, () =>
        db.query(`update public.customers set company_id = $1`, [RIVAL]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('updates and deletes nothing across the boundary', async () => {
    await asCompany(db, ACME, async () => {
      const updated = await db.query(
        `update public.documents set total_minor = 1 where company_id = $1`,
        [RIVAL],
      )
      expect(updated.rowCount).toBe(0)

      const deleted = await db.query(`delete from public.customers where company_id = $1`, [RIVAL])
      expect(deleted.rowCount).toBe(0)
    })
  })

  it('leaves the other company rows exactly as they were', async () => {
    await db.query('set role service_role')
    const { rows } = await db.query(
      'select total_minor from public.documents where company_id = $1',
      [RIVAL],
    )
    await db.query('reset role')
    expect(rows.map((r) => Number(r.total_minor))).toEqual([9900000])
  })
})

describe('The client never writes billing (CLAUDE.md, §U)', () => {
  it('reads its own entitlement', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query('select plan from public.entitlements')
      expect(rows.map((r) => r.plan)).toEqual(['free'])
    })
  })

  it('cannot upgrade itself', async () => {
    // With no UPDATE policy the row is simply invisible to the writer, so this
    // is a silent no-op rather than an error — assert the outcome, not a throw.
    await asCompany(db, ACME, async () => {
      const updated = await db.query(
        `update public.entitlements set plan = 'pro' where company_id = $1`,
        [ACME],
      )
      expect(updated.rowCount).toBe(0)
    })

    await db.query('set role service_role')
    const { rows } = await db.query('select plan from public.entitlements where company_id = $1', [
      ACME,
    ])
    await db.query('reset role')
    expect(rows.map((r) => r.plan)).toEqual(['free'])
  })

  it('cannot write a subscription', async () => {
    await expect(
      asCompany(db, ACME, () =>
        db.query(
          `insert into public.subscriptions (company_id, platform, product_id, status)
           values ($1, 'apple', 'pro_monthly', 'active')`,
          [ACME],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })
})

describe('Public-link tokens are server-only (§P)', () => {
  it('denies a client even its own company rows', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query('select * from public.document_signing_tokens')
      expect(rows).toEqual([])
    })

    await expect(
      asCompany(db, ACME, () =>
        db.query(
          `insert into public.document_signing_tokens (document_id, company_id, token_hash, expires_at)
           values ('dddddddd-0000-0000-0000-000000000001', $1, 'hash', now() + interval '14 days')`,
          [ACME],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })
})

describe('The audit log is append-only (§P)', () => {
  it('accepts an append and refuses an edit', async () => {
    await asCompany(db, ACME, async () => {
      await db.query(
        `insert into public.audit_log (company_id, action, entity) values ($1, 'issue', 'document')`,
        [ACME],
      )
      const updated = await db.query(`update public.audit_log set action = 'tampered'`)
      expect(updated.rowCount).toBe(0)
      const deleted = await db.query('delete from public.audit_log')
      expect(deleted.rowCount).toBe(0)
    })
  })
})
