/**
 * What a store notification does to a subscription (§U, §V).
 *
 * §U: "App Store Server Notifications v2, Play Real-Time Developer
 * Notifications and web-provider webhooks land on Supabase Edge Functions,
 * are **signature-verified and idempotently applied** (replayed events change
 * nothing) into `subscriptions`."
 * §V: "Replayed or out-of-order billing webhooks change nothing."
 *
 * Those two sentences are the whole of this file, and the second is the hard
 * one. Idempotence by event id is easy; ORDER is not. Stores retry, and a
 * retry of DID_RENEW can arrive after the EXPIRED that followed it — at which
 * point a naive handler resurrects a dead subscription and hands out a month
 * of Pro that nobody paid for.
 *
 * So nothing here applies an event because of what it IS. Every decision is
 * made against the event's own timestamp versus the state's: an event older
 * than what is already recorded is acknowledged and dropped. That makes
 * replay and reordering the same problem, solved once.
 *
 * **No signature is checked here.** Verification needs Apple's JWS chain and
 * Google's Pub/Sub envelope and belongs at the edge, where the raw request
 * is. This file is given an event that is already trusted and decides what it
 * means — the same separation the payment webhook uses.
 */

export type Platform = 'apple' | 'google' | 'web'

/** The statuses `subscriptions.status` allows (0005). */
export type Status = 'trial' | 'active' | 'grace' | 'on_hold' | 'cancelled' | 'expired'

/**
 * A store event, normalised.
 *
 * Both stores are reduced to this before any decision is made, so the rules
 * are written once. Mapping Apple's `notificationType`/`subtype` pairs and
 * Google's numeric `notificationType` into it is the edge's job.
 */
export interface StoreEvent {
  readonly platform: Platform
  /** The store's own id for this notification. Idempotency turns on it. */
  readonly eventId: string
  /** When the STORE says this happened. Ordering turns on it. */
  readonly at: string
  readonly kind: EventKind
  /** The subscription this is about, in the store's terms. */
  readonly subscriptionKey: string
  readonly productId: string
  /** End of the paid period after this event, when the store states one. */
  readonly periodEnd?: string
}

/**
 * What happened, in words that mean the same thing on both stores.
 *
 * `renewed` and `recovered` are separate on purpose: recovery from billing
 * retry is the state that must clear `on_hold`, and collapsing it into
 * `renewed` loses that.
 */
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

export interface SubscriptionState {
  readonly status: Status
  readonly productId: string
  readonly currentPeriodEnd?: string
  readonly autoRenew: boolean
  /** The timestamp of the newest event already applied. */
  readonly lastEventAt?: string
}

export type Outcome =
  | { readonly applied: true; readonly next: SubscriptionState }
  | { readonly applied: false; readonly why: 'already_seen' | 'older_than_state' }

const time = (iso: string | undefined): number => {
  if (iso === undefined) return 0
  const at = new Date(iso).getTime()
  return Number.isNaN(at) ? 0 : at
}

/**
 * §U: "Downgrade/cancel keeps Pro until the paid period ends."
 *
 * So `cancelled` is not an ending. It turns auto-renew off and leaves the
 * period alone; the entitlement stays Pro until `valid_until` passes, which
 * is `src/domain/billing/entitlement.ts`'s business and not this file's.
 */
const STATUS_OF: Record<EventKind, Status> = {
  subscribed: 'active',
  trial_started: 'trial',
  renewed: 'active',
  recovered: 'active',
  billing_retry: 'grace',
  on_hold: 'on_hold',
  cancelled: 'cancelled',
  expired: 'expired',
  // A refund or a revocation ends entitlement NOW, not at period end: the
  // money went back. §U's "refund and chargeback paths verified to downgrade
  // without touching documents" is the other half, and it is Rule #6's.
  refunded: 'expired',
  revoked: 'expired',
}

/** Events that end the paid period immediately rather than at its date. */
const ENDS_NOW: readonly EventKind[] = ['refunded', 'revoked']

export function apply(
  state: SubscriptionState | null,
  event: StoreEvent,
  seen: readonly string[],
): Outcome {
  // Replay: the store retried, or two deliveries raced. Nothing to do.
  if (seen.includes(event.eventId)) return { applied: false, why: 'already_seen' }

  // Out of order: a retry of an older event arriving after a newer one. The
  // test is the store's own clock, not ours and not arrival order.
  if (state !== null && time(event.at) < time(state.lastEventAt)) {
    return { applied: false, why: 'older_than_state' }
  }

  const status = STATUS_OF[event.kind]
  const endsNow = ENDS_NOW.includes(event.kind)

  return {
    applied: true,
    next: {
      status,
      productId: event.productId,
      ...(endsNow
        ? { currentPeriodEnd: event.at }
        : event.periodEnd !== undefined
          ? { currentPeriodEnd: event.periodEnd }
          : state?.currentPeriodEnd !== undefined
            ? { currentPeriodEnd: state.currentPeriodEnd }
            : {}),
      // Cancelling turns renewal off and changes nothing else; §U keeps the
      // plan to the end of the period somebody paid for.
      autoRenew: !(
        event.kind === 'cancelled' ||
        event.kind === 'expired' ||
        endsNow
      ),
      lastEventAt: event.at,
    },
  }
}

/**
 * The entitlement a subscription implies.
 *
 * Separate from `apply` because a company may hold more than one subscription
 * over its life — an Apple one that lapsed, a web one that took over (§U:
 * "one company, one plan, whichever rail paid for it") — and the entitlement
 * is the best of them rather than the newest.
 */
export function entitlementFrom(
  subscriptions: readonly SubscriptionState[],
  graceDays: number,
  now: Date,
): { readonly plan: 'free' | 'pro'; readonly validUntil?: string; readonly graceUntil?: string } {
  const paid = subscriptions
    .filter((row) => row.status !== 'expired')
    .map((row) => time(row.currentPeriodEnd))
    .filter((end) => end > now.getTime())

  const best = Math.max(0, ...paid)
  if (best === 0) return { plan: 'free' }

  return {
    plan: 'pro',
    validUntil: new Date(best).toISOString(),
    graceUntil: new Date(best + graceDays * 86_400_000).toISOString(),
  }
}
