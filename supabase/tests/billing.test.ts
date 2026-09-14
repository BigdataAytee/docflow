/**
 * Store billing, against a real Postgres (§U, §V, §Q Phase 7).
 *
 * §V's gate: "Replayed or out-of-order billing webhooks change nothing." The
 * rules are unit-tested in `src/domain/billing`; this is the other half —
 * whether the DATABASE keeps them when two deliveries race, which is the only
 * place that question can honestly be asked.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, connectionString, supabaseClaims } from './apply'

const ACME = '11111111-1111-1111-1111-111111111111'
const RIVAL = '22222222-2222-2222-2222-222222222222'
const OWNER = 'aaaa0000-0000-0000-0000-0000000000a1'

let db: Client

const day = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString()

async function applyEvent(over: Record<string, unknown> = {}): Promise<{ applied: boolean; why?: string; plan?: string }> {
  const args = {
    event_id: 'evt_1',
    company_id: ACME,
    platform: 'apple',
    kind: 'subscribed',
    occurred_at: day(0),
    status: 'active',
    product_id: 'pro_monthly',
    subscription_key: 'orig_1',
    period_end: day(30),
    auto_renew: true,
    ...over,
  }
  const { rows } = await db.query<{ result: { applied: boolean; why?: string; plan?: string } }>(
    `select public.apply_store_billing_event(
       $1, $2::uuid, $3, $4, $5::timestamptz, $6, $7, $8, $9::timestamptz, $10::boolean
     ) as result`,
    [
      args.event_id,
      args.company_id,
      args.platform,
      args.kind,
      args.occurred_at,
      args.status,
      args.product_id,
      args.subscription_key,
      args.period_end,
      args.auto_renew,
    ],
  )
  return rows[0]?.result ?? { applied: false }
}

const entitlement = async () => {
  const { rows } = await db.query<{ plan: string; valid_until: Date | null; grace_until: Date | null }>(
    'select plan, valid_until, grace_until from public.entitlements where company_id = $1',
    [ACME],
  )
  return rows[0]
}

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)
}, 60_000)

beforeEach(async () => {
  await db.query('set role service_role')
  await db.query('delete from public.store_billing_events')
  await db.query('delete from public.entitlements')
  await db.query('delete from public.subscriptions')
  await db.query('delete from public.users')
  await db.query('delete from public.companies')
  await db.query(
    `insert into public.companies (id, name, currency, locale_region)
     values ($1, 'Sola Ventures', 'NGN', 'NG'), ($2, 'Rival Traders', 'NGN', 'NG')`,
    [ACME, RIVAL],
  )
  await db.query(
    `insert into public.users (id, company_id, role, display_name, permissions)
     values ($1, $2, 'owner', 'Ada', '{}'::jsonb)`,
    [OWNER, ACME],
  )
})

afterAll(async () => {
  await db.end()
})

describe('A notification is applied exactly once (§V)', () => {
  it('makes a company Pro, and derives the entitlement from it', async () => {
    expect(await applyEvent()).toMatchObject({ applied: true, plan: 'pro' })

    const row = await entitlement()
    expect(row?.plan).toBe('pro')
    expect(row?.valid_until).not.toBeNull()
    // §U's offline grace: the window sits PAST the paid period.
    expect(row?.grace_until?.getTime() ?? 0).toBeGreaterThan(row?.valid_until?.getTime() ?? 0)
  })

  it('drops a replay, and does not extend anything', async () => {
    await applyEvent()
    const before = await entitlement()

    const second = await applyEvent()
    expect(second).toEqual({ applied: false, why: 'already_seen' })
    expect((await entitlement())?.valid_until?.toISOString()).toBe(
      before?.valid_until?.toISOString(),
    )
  })

  it('refuses an event older than the state, and says why', async () => {
    // A retried renewal arriving after the expiry that followed it.
    await applyEvent({ event_id: 'evt_new', kind: 'expired', status: 'expired', occurred_at: day(40), period_end: day(40) })
    const late = await applyEvent({
      event_id: 'evt_late',
      kind: 'renewed',
      occurred_at: day(30),
      period_end: day(60),
    })

    expect(late).toEqual({ applied: false, why: 'older_than_state' })
    expect((await entitlement())?.plan).toBe('free')

    const { rows } = await db.query<{ skipped_reason: string | null }>(
      'select skipped_reason from public.store_billing_events where event_id = $1',
      ['evt_late'],
    )
    // Recorded, so it can be counted in production rather than guessed at.
    expect(rows[0]?.skipped_reason).toBe('older_than_state')
  })

  it('keeps Pro to the end of a cancelled period (§U)', async () => {
    await applyEvent({ event_id: 'a', kind: 'subscribed', period_end: day(30) })
    await applyEvent({
      event_id: 'b',
      kind: 'cancelled',
      status: 'cancelled',
      occurred_at: day(1),
      period_end: day(30),
      auto_renew: false,
    })

    // Cancelling is not an ending. The plan runs to the date somebody paid for.
    expect((await entitlement())?.plan).toBe('pro')
  })

  it('takes the furthest paid date across rails (§U)', async () => {
    await applyEvent({ event_id: 'apple', platform: 'apple', subscription_key: 'orig_1', period_end: day(5) })
    await applyEvent({
      event_id: 'web',
      platform: 'web',
      subscription_key: 'sub_web',
      occurred_at: day(1),
      period_end: day(45),
    })

    // "One company, one plan, whichever rail paid for it." An Apple
    // subscription ending sooner cannot shorten a web one.
    const row = await entitlement()
    expect(row?.plan).toBe('pro')
    expect(row?.valid_until?.getTime() ?? 0).toBeGreaterThan(Date.parse(day(40)))
  })
})

describe('Only the server writes billing (CLAUDE.md, §U)', () => {
  async function asOwner<T>(run: () => Promise<T>): Promise<T> {
    await db.query('begin')
    try {
      await db.query('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        supabaseClaims(ACME, OWNER),
      ])
      return await run()
    } finally {
      await db.query('rollback')
    }
  }

  it('refuses the apply function to a signed-in user', async () => {
    await expect(
      asOwner(() =>
        db.query(
          `select public.apply_store_billing_event(
             'forged', $1::uuid, 'apple', 'subscribed', now(), 'active', 'pro_monthly',
             'orig_x', now() + interval '30 days', true)`,
          [ACME],
        ),
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('refuses a user writing entitlements directly', async () => {
    // The client deciding what it bought is the whole thing §U forbids.
    await expect(
      asOwner(() =>
        db.query(
          `insert into public.entitlements (company_id, plan) values ($1, 'pro')`,
          [ACME],
        ),
      ),
    ).rejects.toThrow()
  })

  it('lets the company READ its own billing history, and nobody else’s', async () => {
    await applyEvent()
    const mine = await asOwner(() =>
      db.query('select event_id from public.store_billing_events'),
    )
    expect(mine.rows).toHaveLength(1)

    await db.query('set role service_role')
    await applyEvent({ event_id: 'theirs', company_id: RIVAL, subscription_key: 'orig_r' })
    const stillMine = await asOwner(() =>
      db.query('select event_id from public.store_billing_events'),
    )
    expect(stillMine.rows).toHaveLength(1)
  })
})
