/**
 * Rate limiting for the public edge functions (§P: "rate limiting on auth and
 * public endpoints", §Q Phase 7 "rate-limit verification").
 *
 * The counting happens in Postgres — `check_rate_limit`, migration 0019 —
 * because it has to be SHARED. What `public-link` had before was a `Map` in
 * module scope: per instance, lost on every cold start, counting nothing
 * across the instances a deployment actually runs. Its own comment admitted
 * as much, and a limiter that admits it is not one is still not one.
 *
 * What lives here is the part that is a judgement rather than a count: which
 * buckets exist, what key each one uses, and what happens when the limiter
 * itself is unavailable.
 *
 * Nothing here touches a Deno global, so the app's own test suite imports it
 * and pins these decisions.
 */

/** One budget: a name nothing else shares, a ceiling, and a window. */
export interface RateBucket {
  readonly bucket: string
  readonly limit: number
  readonly windowSeconds: number
}

/**
 * `public-link`, per token — a run of guesses at ONE link, and the bucket a
 * customer re-opening their own link sits in, nowhere near the ceiling.
 */
export const TOKEN_BUCKET: RateBucket = {
  bucket: 'public_link_token',
  limit: 20,
  windowSeconds: 60,
}

/**
 * `public-link`, per caller — the guessing run the per-token bucket cannot see
 * AT ALL, because every guess is a different token and so a different key.
 * That was the real hole in the old limiter, and shared state alone would not
 * have closed it.
 *
 * Deliberately loose: a whole office behind one address shares it, and §P's
 * "a customer must not be locked out by a stranger" covers them too. Sized to
 * stop a script, not a family.
 */
export const CALLER_BUCKET: RateBucket = {
  bucket: 'public_link_caller',
  limit: 120,
  windowSeconds: 60,
}

/**
 * `store-notifications`, per company — the ONE thing an unsigned caller can
 * make that endpoint do is write a parked ledger row, and the row's id comes
 * out of the body, so distinct ids mean unbounded rows. This bounds it.
 *
 * It is charged on the UNVERIFIED path only. A verified store event is never
 * throttled: dropping one would lose a subscription change, and §U's ordering
 * rules assume every event arrives.
 *
 * A real store sends single figures per company per day; this is orders of
 * magnitude above anything Apple or Google would send and still bounds a flood.
 */
export const STORE_PARK_BUCKET: RateBucket = {
  bucket: 'store_notifications_park',
  limit: 60,
  windowSeconds: 3600,
}

/** SHA-256, hex. The same routine the tokens use. */
export async function hashKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The caller's address: the first hop of `x-forwarded-for`, which is the one
 * the platform wrote and the only one a client cannot get ahead of.
 *
 * `null` when there is no header, and the per-caller bucket is then SKIPPED
 * rather than charged to a shared "unknown" key. A shared key would let one
 * script spend a budget every anonymous caller draws from — a lockout built
 * out of a limiter. The per-token bucket still applies.
 */
export function callerKey(forwardedFor: string | null | undefined): string | null {
  const first = (forwardedFor ?? '').split(',')[0]?.trim() ?? ''
  return first === '' ? null : first
}

/** Just enough of the supabase client to call one function. */
export interface RpcCaller {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>
}

/**
 * Charge one request to one bucket, and say whether it is over.
 *
 * The key is HASHED before it is sent: a token must never reach the database
 * (§P), and a counter table must not quietly become a log of which address
 * read which document.
 *
 * It fails OPEN. If the limiter itself is unreachable the request is allowed,
 * because failing closed means every customer's link goes dark on a database
 * blip — Rule 6, documents are never hostage — while failing open means a
 * minute of unthrottled guessing against 32 random bytes.
 */
export async function overLimit(
  client: RpcCaller,
  bucket: RateBucket,
  key: string,
): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('check_rate_limit', {
      p_bucket: bucket.bucket,
      p_key: await hashKey(key),
      p_limit: bucket.limit,
      p_window_seconds: bucket.windowSeconds,
    })
    if (error !== null && error !== undefined) return false
    return (data as { allowed?: boolean } | null)?.allowed === false
  } catch {
    return false
  }
}

/**
 * `payment-webhook`, per company.
 *
 * The route is public — it has to be, a provider cannot sign in — and every
 * request costs an indexed credentials lookup plus an HMAC before it can be
 * judged. That is small and it is not nothing, and the route name carries the
 * company id, so anybody who has seen one webhook URL can aim at it.
 *
 * Sized against reality rather than against fear: a busy Nigerian business
 * takes single-figure card payments an hour, and Paystack retries a handful
 * of times on failure. Three hundred an hour is two orders of magnitude above
 * that and still bounds a flood.
 */
export const PAYMENT_WEBHOOK_BUCKET: RateBucket = {
  bucket: 'payment_webhook_caller',
  limit: 300,
  windowSeconds: 3600,
}

/**
 * The largest body these functions will read (§P).
 *
 * Every one of them reads the whole request into memory before it can judge
 * it — a webhook has to, because the signature covers the bytes. Without a
 * ceiling that is an unauthenticated route allocating whatever a caller sends,
 * which costs compute and memory before a single check has run.
 *
 * TWO CEILINGS, because the two bodies are not the same kind of thing:
 *
 *  · A PROVIDER EVENT is JSON. A Paystack charge is a couple of KB and an
 *    Apple notification a little more, so 256 KB is two orders of magnitude
 *    above anything real.
 *  · A SIGNING REQUEST carries the mark the recipient just drew, as a data
 *    URL. That is the whole point of the endpoint, and sizing it like a
 *    webhook would refuse the signature it exists to accept — a cap that
 *    breaks the feature is worse than no cap, because somebody removes it.
 */
export const MAX_EVENT_BYTES = 256 * 1024
export const MAX_SIGNATURE_BYTES = 1024 * 1024

/**
 * Whether the caller declared a body too large to be worth reading.
 *
 * `content-length` is a claim, not a fact — a chunked request can lie or omit
 * it — so this is the cheap first gate, not the only one. It costs nothing and
 * it stops the honest-but-oversized case before anything is allocated.
 */
export function bodyTooLarge(headers: Headers, limit: number): boolean {
  const declared = Number(headers.get('content-length') ?? '0')
  return Number.isFinite(declared) && declared > limit
}

/**
 * Read a body, refusing one that turns out to be oversized.
 *
 * The second half of the gate: a caller that omitted `content-length`, or lied
 * about it, is caught here by measuring what actually arrived. Returns null
 * rather than throwing, so each caller answers in its own idiom — 200 with a
 * reason for the webhooks, a refusal for the public link.
 */
export async function readBounded(request: Request, limit: number): Promise<string | null> {
  if (bodyTooLarge(request.headers, limit)) return null
  const text = await request.text()
  return new TextEncoder().encode(text).length > limit ? null : text
}
