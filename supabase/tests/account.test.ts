/**
 * Account bootstrap — the first company a new sign-up belongs to (§R, §P).
 *
 * Every rule here is about authority: this is the one SECURITY DEFINER
 * function a signed-in client can call, and it exists because the caller has
 * no company yet and therefore no policy it could satisfy. What bounds it is
 * tested, not asserted in a comment.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, connectionString, supabaseClaims } from './apply'

const ADA = 'aaaa0000-0000-0000-0000-00000000000a'
const BOLA = 'bbbb0000-0000-0000-0000-00000000000b'
const OTHER_COMPANY = '33333333-3333-3333-3333-333333333333'

let db: Client

/**
 * Signed in as a user whose token carries NO company — a fresh sign-up.
 *
 * COMMITS, unlike `asCompany`. What this file tests is what survives the call,
 * and a rollback would hide exactly that. `beforeEach` clears the tables
 * instead.
 */
async function asNewUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
  await db.query('begin')
  try {
    await db.query('set local role authenticated')
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({
        sub: userId,
        role: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] },
      }),
    ])
    const result = await run()
    await db.query('commit')
    return result
  } catch (cause) {
    await db.query('rollback')
    throw cause
  }
}

/**
 * Read past RLS, as the test's own observer.
 *
 * Every check in this file is about what the FUNCTION wrote, and the caller
 * who triggered it cannot see any of it: their token still carries no company,
 * so `public.users` and `public.companies` both deny them. Verifying as the
 * caller would prove only that RLS works, which other files already do.
 */
async function asObserver<T>(run: () => Promise<T>): Promise<T> {
  await db.query('set role service_role')
  try {
    return await run()
  } finally {
    await db.query('reset role')
  }
}

const create = (name: string, region = 'NG', currency = 'NGN') =>
  db.query<{ result: { company: Record<string, unknown>; created: boolean } }>(
    `select public.create_company_for_new_user($1, $2, $3) as result`,
    [name, region, currency],
  )

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)
}, 60_000)

beforeEach(async () => {
  await db.query('set role service_role')
  await db.query(`delete from public.users`)
  await db.query(`delete from public.companies`)
  await db.query(`delete from auth.users`)
  await db.query(
    `insert into auth.users (id, email, raw_app_meta_data) values
       ($1, 'ada@example.test', '{"provider":"email","providers":["email"]}'::jsonb),
       ($2, 'bola@example.test', '{"provider":"email","providers":["email"]}'::jsonb)`,
    [ADA, BOLA],
  )
  await db.query(
    `insert into public.companies (id, name, currency, locale_region)
     values ($1, 'Someone Else Ltd', 'NGN', 'NG')`,
    [OTHER_COMPANY],
  )
  await db.query('reset role')
})

afterAll(async () => {
  await db?.end()
})

describe('A new sign-up gets a company (§R)', () => {
  it('creates the company and makes the first user its owner', async () => {
    const companyId = await asNewUser(ADA, async () => {
      const { rows } = await create('Sola Ventures', 'GH', 'GHS')
      expect(rows[0]!.result.created).toBe(true)
      expect(rows[0]!.result.company.name).toBe('Sola Ventures')
      // The region is taken at sign-up, not defaulted later: §R sets
      // terminology, currency and bank fields in one confirmation.
      expect(rows[0]!.result.company.locale_region).toBe('GH')
      expect(rows[0]!.result.company.currency).toBe('GHS')
      return String(rows[0]!.result.company.id)
    })

    const user = await asObserver(() =>
      db.query(`select company_id, role, email from public.users where id = $1`, [ADA]),
    )
    expect(user.rows[0]!.company_id).toBe(companyId)
    // The first user of a company owns it; everyone later arrives through an
    // invitation, which is a different flow with a different authority.
    expect(user.rows[0]!.role).toBe('owner')
    // Read from auth.users inside the function — a signed-in client cannot
    // read that table, which is one reason the function must be DEFINER.
    expect(user.rows[0]!.email).toBe('ada@example.test')
  })

  it('stamps the claim that the NEXT token will carry', async () => {
    const companyId = await asNewUser(ADA, async () => {
      const { rows } = await create('Sola Ventures')
      return rows[0]!.result.company.id
    })

    const meta = await asObserver(() =>
      db.query(`select raw_app_meta_data as m from auth.users where id = $1`, [ADA]),
    )
    // Without this the account is created and still shows nothing: the token
    // carries no company and every policy denies it (0013).
    expect(meta.rows[0]!.m.company_id).toBe(companyId)
    // Merged, not replaced: Supabase keeps the sign-in provider here, and
    // overwriting it would break the account's own sign-in metadata.
    expect(meta.rows[0]!.m.provider).toBe('email')
  })

  it('lets the caller read their own company once the claim is in the token', async () => {
    const companyId = await asNewUser(ADA, async () => {
      const { rows } = await create('Sola Ventures')
      return String(rows[0]!.result.company.id)
    })
    // The trip the real client makes: create, refresh the session, come back
    // with a token that names the company.
    await db.query('begin')
    try {
      await db.query('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        supabaseClaims(String(companyId), ADA),
      ])
      const { rows } = await db.query('select name from public.companies')
      expect(rows.map((r) => r.name)).toEqual(['Sola Ventures'])
    } finally {
      await db.query('rollback')
    }
  })
})

describe('What the authority is bounded by (§P)', () => {
  it('refuses a caller with no session', async () => {
    await db.query('begin')
    try {
      await db.query('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', '', true)`)
      await expect(create('Nobody Ltd')).rejects.toThrow(/Not signed in/)
    } finally {
      await db.query('rollback')
    }
  })

  it('never moves a user who already has a company', async () => {
    await db.query('set role service_role')
    await db.query(`insert into public.users (id, company_id, role) values ($1, $2, 'staff')`, [
      ADA,
      OTHER_COMPANY,
    ])
    await db.query('reset role')

    await asNewUser(ADA, async () => {
      const { rows } = await create('A Company I Would Rather Own')
      // Returned, not raised: a retried first run is harmless (§M). But the
      // company is the one they already belong to, and no new one is made.
      expect(rows[0]!.result.created).toBe(false)
      expect(rows[0]!.result.company.id).toBe(OTHER_COMPANY)
    })

    const companies = await asObserver(() =>
      db.query(`select count(*)::int as n from public.companies`),
    )
    expect(companies.rows[0]!.n).toBe(1)
  })

  it('acts only on the calling user, with no id to point elsewhere', async () => {
    await asNewUser(ADA, async () => {
      await create('Ada Ventures')
    })
    // Bola's own call creates Bola's own company. There is no argument by
    // which Ada could have created one for Bola, or joined Bola to hers.
    const bolaCompany = await asNewUser(BOLA, async () => {
      const { rows } = await create('Bola Trading')
      return rows[0]!.result.company.id
    })

    const bola = await asObserver(() =>
      db.query(`select company_id from public.users where id = $1`, [BOLA]),
    )
    expect(bola.rows[0]!.company_id).toBe(bolaCompany)
    expect(bola.rows[0]!.company_id).not.toBe(OTHER_COMPANY)
  })

  it('refuses a business with no name', async () => {
    await asNewUser(ADA, async () => {
      await db.query('savepoint before_blank')
      await expect(create('   ')).rejects.toThrow(/needs a name/)
      await db.query('rollback to savepoint before_blank')
    })
  })

  it('is not callable by an anonymous role at all', async () => {
    await db.query('begin')
    try {
      await db.query('set local role anon')
      // Not granted to `anon`: the refusal happens before the function body
      // rather than inside it.
      await expect(create('Anon Ltd')).rejects.toThrow(/permission denied/i)
    } finally {
      await db.query('rollback')
    }
  })
})
