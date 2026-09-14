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

import { applyMigrations, asCompany, connectionString, flatClaims, supabaseClaims } from './apply'

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

describe('The company claim, as Supabase actually issues it (§P)', () => {
  /**
   * PERMANENT REGRESSION TEST — do not delete, and do not "simplify" the
   * claims shape it builds.
   *
   * `current_company_id()` read a TOP-LEVEL `company_id` claim. A real
   * Supabase token has no such thing: custom claims arrive nested under
   * `app_metadata`. In production the function returned NULL for every
   * signed-in user, every policy denied everything, and the app would have
   * signed people in and then shown them an empty account on every screen,
   * with no error anywhere.
   *
   * The whole suite passed throughout, because the harness set the claims GUC
   * to a flat object by hand — it proved the policies were right about a
   * shape that does not exist. That is the failure this test exists to stop
   * repeating, so it asserts the NESTED shape specifically.
   */
  it('resolves a company from a real nested app_metadata claim', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query('select public.current_company_id() as company')
      expect(rows[0]?.company).toBe(ACME)
    }, supabaseClaims)
  })

  it('still resolves the flat shape an edge function sets', async () => {
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query('select public.current_company_id() as company')
      expect(rows[0]?.company).toBe(ACME)
    }, flatClaims)
  })

  it('sees a company through the nested claim, not just the function', async () => {
    // The function resolving is necessary but not sufficient: what matters is
    // that a policy lets a real token read a real row.
    await asCompany(db, ACME, async () => {
      const { rows } = await db.query('select name from public.customers')
      expect(rows.map((r) => r.name)).toEqual(['Okoro & Sons'])
    }, supabaseClaims)
  })

  it('returns null when app_metadata carries no company at all', async () => {
    // What a NORMAL sign-up looks like: Supabase sets provider fields and
    // nothing else. Denying is correct; the account just has no company yet.
    await db.query('begin')
    try {
      await db.query('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({
          sub: '99999999-9999-9999-9999-999999999999',
          role: 'authenticated',
          app_metadata: { provider: 'email', providers: ['email'] },
        }),
      ])
      const { rows } = await db.query('select public.current_company_id() as company')
      expect(rows[0]?.company).toBeNull()
      const customers = await db.query('select * from public.customers')
      expect(customers.rows).toEqual([])
    } finally {
      await db.query('rollback')
    }
  })
})

/**
 * Tables nobody signs in to read.
 *
 * The rule below exists because a table added after 0006's blanket grant is
 * unusable in a way that looks perfect from here. `deleted_accounts` is the
 * deliberate opposite: it is the tombstone left after an account is purged,
 * and no user token should ever reach it — the company it names no longer
 * exists, and there is nobody left to be entitled to the row.
 *
 * Named rather than skipped by a regex, and EARNED rather than declared: the
 * test below proves the exempt table really is closed to `authenticated`, has
 * RLS enabled and forced, and carries no policy that could open it. A second
 * name on this list has to be argued for in this file.
 */
const SERVICE_ROLE_ONLY = ['deleted_accounts']

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
    expect(rows.map((r) => r.table)).toEqual(SERVICE_ROLE_ONLY)
  })

  it('earns that exemption: the exempt tables are shut, not merely ungranted', async () => {
    for (const table of SERVICE_ROLE_ONLY) {
      const { rows } = await db.query<{
        enabled: boolean
        forced: boolean
        policies: string
        granted: boolean
      }>(
        `select c.relrowsecurity as enabled,
                c.relforcerowsecurity as forced,
                (select count(*) from pg_policy p where p.polrelid = c.oid) as policies,
                has_table_privilege('authenticated', c.oid, 'SELECT') as granted
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = $1`,
        [table],
      )
      const row = rows[0]
      expect(row, `${table} does not exist`).toBeDefined()
      // FORCE as well as ENABLE: without it the table's owner reads straight
      // past its own policies, which is the §P lesson from 0006.
      expect(row?.enabled, `${table} has RLS off`).toBe(true)
      expect(row?.forced, `${table} does not FORCE RLS`).toBe(true)
      // No policy at all, so there is nothing to widen by accident.
      expect(Number(row?.policies ?? -1), `${table} carries a policy`).toBe(0)
      expect(row?.granted, `${table} is granted to authenticated after all`).toBe(false)
    }
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
   * Phase 7 — service-role penetration checks, tested separately.
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
   * key — which is a build-and-deploy check, not a SQL one. That half now
   * exists and runs in CI: `tools/pentest/secrets.test.ts`. The scripted
   * roster is `tools/pentest/checks.ts` and still needs an instance.
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
