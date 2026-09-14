/**
 * Store notifications, normalised (§U, §V).
 *
 * Apple and Google describe the same seven or eight things in two entirely
 * different vocabularies. Everything downstream — the ledger, the ordering,
 * the entitlement — is written once against the shape in
 * `src/domain/billing/notifications.ts`, and this is the translation.
 *
 * **What this file will not do: pretend an event is verified.**
 *
 * Apple signs ASSN v2 as a JWS whose `x5c` chain must be validated up to
 * Apple's own root, and Google delivers RTDN through Pub/Sub with a
 * Google-signed OIDC token in the Authorization header that must be checked
 * against Google's rotating keys. Neither can be implemented honestly without
 * something to test it against: a sandbox notification from a real App Store
 * Connect account, and a real Pub/Sub push. Writing an unexercised verifier
 * that gates money would be worse than writing none — it is the same call the
 * payment webhook made for Flutterwave and PayPal, and for the same reason.
 *
 * So `verified()` returns false for both, every event is PARKED in the ledger
 * unapplied, and nothing reaches `subscriptions`. The ordering, idempotence
 * and entitlement logic behind it are built and proven against Postgres; the
 * door simply stays shut until somebody can check who is knocking. That
 * somebody needs the accounts D10 has always needed.
 */

export type Platform = 'apple' | 'google'

export type EventKind =
  | 'subscribed'
  | 'trial_started'
  | 'renewed'
  | 'recovered'
  | 'billing_retry'
  | 'on_hold'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'revoked'

export interface StoreEvent {
  readonly platform: Platform
  readonly eventId: string
  readonly at: string
  readonly kind: EventKind
  readonly subscriptionKey: string
  readonly productId: string
  readonly periodEnd?: string
}

export const PLATFORMS: readonly Platform[] = ['apple', 'google']

export const isPlatform = (value: string): value is Platform =>
  (PLATFORMS as readonly string[]).includes(value)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `/store-notifications/:platform/:companyId`.
 *
 * The company is in the path for the same reason it is in the payment
 * webhook's: nothing in an Apple notification says which DocFlow company it
 * belongs to. The id selects WHICH subscription to look at and is not itself
 * authority — an attacker who knows it still cannot produce a signature.
 */
export function routeOf(path: string): { platform: Platform; companyId: string } | null {
  const parts = path.split('/').filter((part) => part !== '')
  const index = parts.indexOf('store-notifications')
  if (index === -1) return null

  const platform = parts[index + 1] ?? ''
  const companyId = parts[index + 2] ?? ''
  if (!isPlatform(platform)) return null
  if (!UUID.test(companyId)) return null
  return { platform, companyId }
}

/** Apple's `notificationType` / `subtype` pairs, in DocFlow's words. */
export function appleKind(type: string, subtype?: string): EventKind | null {
  if (type === 'SUBSCRIBED') return subtype === 'RESUBSCRIBE' ? 'subscribed' : 'trial_started'
  if (type === 'DID_RENEW') return subtype === 'BILLING_RECOVERY' ? 'recovered' : 'renewed'
  if (type === 'DID_FAIL_TO_RENEW') return subtype === 'GRACE_PERIOD' ? 'billing_retry' : 'on_hold'
  // Apple's DID_CHANGE_RENEWAL_STATUS carries the whole of cancel-and-resume.
  if (type === 'DID_CHANGE_RENEWAL_STATUS') {
    return subtype === 'AUTO_RENEW_DISABLED' ? 'cancelled' : 'renewed'
  }
  if (type === 'EXPIRED') return 'expired'
  if (type === 'REFUND') return 'refunded'
  if (type === 'REVOKE') return 'revoked'
  return null
}

/**
 * Google's RTDN `subscriptionNotification.notificationType`, which is a
 * number. The numbers are the API's, not ours, so they are written out rather
 * than aliased — a reader with Google's docs open can check this line by line.
 */
export function googleKind(type: number): EventKind | null {
  if (type === 1) return 'recovered' // SUBSCRIPTION_RECOVERED
  if (type === 2) return 'renewed' // SUBSCRIPTION_RENEWED
  if (type === 3) return 'cancelled' // SUBSCRIPTION_CANCELED
  if (type === 4) return 'subscribed' // SUBSCRIPTION_PURCHASED
  if (type === 5) return 'on_hold' // SUBSCRIPTION_ON_HOLD
  if (type === 6) return 'billing_retry' // SUBSCRIPTION_IN_GRACE_PERIOD
  if (type === 12) return 'revoked' // SUBSCRIPTION_REVOKED
  if (type === 13) return 'expired' // SUBSCRIPTION_EXPIRED
  return null
}

const iso = (value: unknown): string | undefined => {
  const ms = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  return new Date(ms).toISOString()
}

export function normaliseApple(body: Record<string, unknown>): StoreEvent | null {
  const data = (body.data ?? {}) as Record<string, unknown>
  const kind = appleKind(String(body.notificationType ?? ''), body.subtype as string | undefined)
  const eventId = String(body.notificationUUID ?? '')
  if (kind === null || eventId === '') return null

  const at = iso(body.signedDate) ?? new Date().toISOString()
  const periodEnd = iso(data.expiresDate)
  return {
    platform: 'apple',
    eventId,
    at,
    kind,
    subscriptionKey: String(data.originalTransactionId ?? ''),
    productId: String(data.productId ?? ''),
    ...(periodEnd === undefined ? {} : { periodEnd }),
  }
}

export function normaliseGoogle(
  body: Record<string, unknown>,
  messageId: string,
): StoreEvent | null {
  const notification = (body.subscriptionNotification ?? {}) as Record<string, unknown>
  const kind = googleKind(Number(notification.notificationType ?? NaN))
  if (kind === null || messageId === '') return null

  const at = iso(body.eventTimeMillis) ?? new Date().toISOString()
  return {
    platform: 'google',
    eventId: messageId,
    at,
    kind,
    // Google's purchase token IS the subscription's identity.
    subscriptionKey: String(notification.purchaseToken ?? ''),
    productId: String(notification.subscriptionId ?? ''),
    // Google states no expiry in the notification; it is fetched from the
    // Play Developer API, which needs a service account. Absent rather than
    // guessed — the apply path keeps the period it already had.
  }
}

/**
 * Is this event's signature checked?
 *
 * **No, on either platform, and that is the honest answer today.** See the
 * header. Until it is yes, the function parks events and applies none.
 */
export function verified(_platform: Platform, _request: { headers: Headers; raw: string }): boolean {
  return false
}

/** Why an event was parked, in words a log can be searched for. */
export const UNVERIFIED_REASON: Record<Platform, string> = {
  apple: 'apple JWS x5c chain not verified — needs Apple root pinning and a sandbox notification to test against',
  google: 'google Pub/Sub OIDC token not verified — needs the push audience and Google key fetch',
}
