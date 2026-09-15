/**
 * App Store Server Notifications v2 and Play RTDN (§Q Phase 7, §U, §V).
 *
 *   POST /store-notifications/:platform/:companyId
 *
 * Service-role, like the payment webhook, and for the same reason: the caller
 * is not a DocFlow user. A store posts here with no session, and the client is
 * never allowed to write `subscriptions` or `entitlements` at all.
 *
 * **Every event is currently PARKED.** `rules.ts` says why at length: neither
 * signature can be verified honestly without an account to test against, and
 * an unexercised verifier standing between a stranger and a paid plan is
 * worse than a closed door. So each notification is recorded in the ledger
 * with a reason and nothing reaches a subscription. The ordering, idempotence
 * and entitlement derivation behind that door are built and proven against
 * Postgres in `supabase/tests/billing.test.ts`.
 *
 * Deploy: supabase functions deploy store-notifications --no-verify-jwt
 * (--no-verify-jwt because the caller is a store with no account. The
 * signature IS the authorisation — once there is one.)
 */

// @ts-expect-error — Deno resolves this at deploy time; the app never builds it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { STORE_PARK_BUCKET, overLimit } from '../_shared/ratelimit.ts'
import {
  type StoreEvent,
  UNVERIFIED_REASON,
  normaliseApple,
  normaliseGoogle,
  routeOf,
  verified,
} from './rules.ts'

declare const Deno: { env: { get(name: string): string | undefined } }

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

/**
 * Always 200, with a short reason.
 *
 * Stores retry hard on a non-2xx — Apple for days, Google until the Pub/Sub
 * message expires — so a refusal returning 401 earns an escalating retry
 * storm for a request that will never become valid. It would also tell a
 * prober which of "wrong company", "bad shape" and "bad signature" they hit.
 */
const ok = (reason: string): Response =>
  new Response(JSON.stringify({ reason }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' },
  })

/** The status each kind implies, kept beside the domain module it mirrors. */
const STATUS: Record<StoreEvent['kind'], string> = {
  subscribed: 'active',
  trial_started: 'trial',
  renewed: 'active',
  recovered: 'active',
  billing_retry: 'grace',
  on_hold: 'on_hold',
  cancelled: 'cancelled',
  expired: 'expired',
  refunded: 'expired',
  revoked: 'expired',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return ok('method')

  const route = routeOf(new URL(request.url).pathname)
  if (route === null) return ok('route')

  const raw = await request.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return ok('body')
  }

  const event =
    route.platform === 'apple'
      ? normaliseApple(body)
      : normaliseGoogle(body, String((body.message as Record<string, unknown>)?.messageId ?? ''))
  if (event === null) return ok('shape')

  // The door. Everything below it is built; nothing goes through it yet.
  if (!verified(route.platform, { headers: request.headers, raw })) {
    // The parked row below is the ONE thing an unsigned caller can make this
    // endpoint write, and its id comes out of the body, so distinct ids mean
    // unbounded rows. Bounded per company, and charged HERE rather than at the
    // top of the handler: a verified store event is never throttled, because
    // dropping one loses a subscription change and §U's ordering assumes every
    // event arrives. Over the limit we still answer 200 — a store that retries
    // a parked event for days helps nobody, and the row is diagnostic, not money.
    if (await overLimit(admin, STORE_PARK_BUCKET, route.companyId)) return ok('rate_limited')

    await admin.from('store_billing_events').upsert(
      {
        event_id: event.eventId,
        company_id: route.companyId,
        platform: event.platform,
        kind: event.kind,
        occurred_at: event.at,
        applied: false,
        skipped_reason: UNVERIFIED_REASON[route.platform],
      },
      { onConflict: 'event_id', ignoreDuplicates: true },
    )
    return ok('unverified')
  }

  const { data, error } = await admin.rpc('apply_store_billing_event', {
    p_event_id: event.eventId,
    p_company_id: route.companyId,
    p_platform: event.platform,
    p_kind: event.kind,
    p_occurred_at: event.at,
    p_status: STATUS[event.kind],
    p_product_id: event.productId,
    p_subscription_key: event.subscriptionKey,
    p_period_end: event.periodEnd ?? null,
    p_auto_renew: event.kind !== 'cancelled' && event.kind !== 'expired',
  })

  if (error !== null) return ok('error')
  return ok(String((data as { applied?: boolean })?.applied === true ? 'applied' : 'skipped'))
}
