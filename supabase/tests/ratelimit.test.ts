/**
 * Rate-limit VERIFICATION (§Q Phase 7, §P).
 *
 * §Q's Phase-7 scope names the word "verification", and this is what the word
 * has to mean for a limiter: not that the arithmetic is right in isolation,
 * but that the counter holds when two callers race it, survives the process
 * restarting, and cannot be read or written by anybody holding a user token.
 * None of those can be asked of a `Map` in module scope, which is what this
 * replaced.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, connectionString, supabaseClaims } from './apply'

const COMPANY = '11111111-1111-1111-1111-111111111111'
const OWNER = 'aaaa0000-0000-0000-0000-0000000000a1'

let db: Client

interface Verdict {
  allowed: boolean
  estimate: number
  retry_after: number
}

const ask = async (
  key: string,
  limit = 3,
  windowSeconds = 60,
  bucket = 'test',
): Promise<Verdict> => {
  const { rows } = await db.query<{ result: Verdict }>(
    'select public.check_rate_limit($1, $2, $3, $4) as result',
    [bucket, key, limit, windowSeconds],
  )
  return rows[0]?.result as Verdict
}

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)
}, 60_000)

beforeEach(async () => {
  await db.query('set role service_role')
  await db.query('delete from public.rate_limit_windows')
  await db.query('delete from public.users')
  await db.query('delete from public.companies')
  await db.query(
    `insert into public.companies (id, name, currency, locale_region)
     values ($1, 'Sola Ventures', 'NGN', 'NG')`,
    [COMPANY],
  )
  await db.query(
    `insert into public.users (id, company_id, role, display_name, permissions)
     values ($1, $2, 'owner', 'Ada', '{}'::jsonb)`,
    [OWNER, COMPANY],
  )
})

afterAll(async () => {
  await db.end()
})

describe('It counts, and it stops', () => {
  it('allows up to the limit and refuses the next one', async () => {
    expect((await ask('a')).allowed).toBe(true)
    expect((await ask('a')).allowed).toBe(true)
    expect((await ask('a')).allowed).toBe(true)
    expect((await ask('a')).allowed).toBe(false)
  })

  it('keeps separate keys and separate buckets apart', async () => {
    for (let i = 0; i < 4; i += 1) await ask('a')
    expect((await ask('a')).allowed).toBe(false)

    // A different caller is not punished for the first one.
    expect((await ask('b')).allowed).toBe(true)
    // And a different endpoint has its own budget.
    expect((await ask('a', 3, 60, 'other')).allowed).toBe(true)
  })

  it('says how long to wait', async () => {
    const verdict = await ask('a')
    expect(verdict.retry_after).toBeGreaterThan(0)
    expect(verdict.retry_after).toBeLessThanOrEqual(60)
  })

  it('refuses a limit or a window that is not one', async () => {
    await expect(ask('a', 0)).rejects.toThrow(/limit and a window/)
    await expect(ask('a', 3, 0)).rejects.toThrow(/limit and a window/)
  })
})

describe('The counter is shared, which is the whole point', () => {
  it('survives the connection that made it going away', async () => {
    // The `Map` this replaced lived in one instance's memory. A second
    // connection is the cheapest honest stand-in for a second instance.
    for (let i = 0; i < 3; i += 1) await ask('shared')

    const other = new Client({ connectionString: connectionString() })
    await other.connect()
    try {
      await other.query('set role service_role')
      const { rows } = await other.query<{ result: Verdict }>(
        `select public.check_rate_limit('test', 'shared', 3, 60) as result`,
      )
      expect(rows[0]?.result.allowed).toBe(false)
    } finally {
      await other.end()
    }
  })

  it('cannot be beaten by two callers racing each other', async () => {
    // Ten simultaneous asks against a limit of three. The upsert counts
    // before it decides, so the row lock serialises them: a read-then-write
    // limiter would let several read "two" and all pass.
    const racers = Array.from({ length: 10 }, async () => {
      const client = new Client({ connectionString: connectionString() })
      await client.connect()
      try {
        await client.query('set role service_role')
        const { rows } = await client.query<{ result: Verdict }>(
          `select public.check_rate_limit('test', 'race', 3, 60) as result`,
        )
        return rows[0]?.result.allowed === true
      } finally {
        await client.end()
      }
    })

    const allowed = (await Promise.all(racers)).filter(Boolean).length
    expect(allowed).toBe(3)
  })
})

describe('A sliding window, not a fixed one', () => {
  it('carries the previous window forward instead of forgiving it wholesale', async () => {
    // The cliff a fixed window has: spend the budget at the end of one
    // window and the next instant hands over a fresh one, so twice the limit
    // passes across the boundary. Written directly into the PREVIOUS window's
    // row, because waiting sixty seconds in a test is not a test.
    const previous = `to_timestamp(floor(extract(epoch from clock_timestamp()) / 60) * 60) - interval '60 seconds'`
    await db.query(
      `insert into public.rate_limit_windows (bucket, key, window_start, hits)
       values ('test', 'edge', ${previous}, 10)`,
    )

    const verdict = await ask('edge', 3, 60)
    // One hit this window, ten weighted from the last: far over three.
    expect(verdict.estimate).toBeGreaterThan(3)
    expect(verdict.allowed).toBe(false)
  })

  it('forgets a window that is properly behind it', async () => {
    const old = `clock_timestamp() - interval '10 minutes'`
    await db.query(
      `insert into public.rate_limit_windows (bucket, key, window_start, hits)
       values ('test', 'stale', to_timestamp(floor(extract(epoch from ${old}) / 60) * 60), 99)`,
    )
    expect((await ask('stale', 3, 60)).allowed).toBe(true)
  })
})

describe('Nobody holding a user token can reach it (§P)', () => {
  async function asOwner<T>(run: () => Promise<T>): Promise<T> {
    await db.query('begin')
    try {
      await db.query('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        supabaseClaims(COMPANY, OWNER),
      ])
      return await run()
    } finally {
      await db.query('rollback')
    }
  }

  it('refuses the function', async () => {
    await expect(
      asOwner(() => db.query(`select public.check_rate_limit('test', 'k', 3, 60)`)),
    ).rejects.toThrow(/permission denied/i)
  })

  it('refuses the counters, to read and to write', async () => {
    // Readable counters are counters somebody plans around; writable ones are
    // not a limit at all.
    await expect(
      asOwner(() => db.query('select * from public.rate_limit_windows')),
    ).rejects.toThrow(/permission denied/i)

    await expect(
      asOwner(() =>
        db.query(
          `insert into public.rate_limit_windows (bucket, key, window_start, hits)
           values ('test', 'forged', now(), 0)`,
        ),
      ),
    ).rejects.toThrow(/permission denied/i)
  })
})
