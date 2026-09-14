/**
 * What a store notification does to a subscription (§U, §V).
 *
 * §V's gate: "Replayed or out-of-order billing webhooks change nothing."
 */

import { describe, expect, it } from 'vitest'

import {
  type EventKind,
  type StoreEvent,
  type SubscriptionState,
  apply,
  entitlementFrom,
} from './notifications'

const NOW = new Date('2026-09-14T09:00:00.000Z')
const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString()

const event = (over: Partial<StoreEvent> = {}): StoreEvent => ({
  platform: 'apple',
  eventId: 'evt_1',
  at: at(0),
  kind: 'subscribed',
  subscriptionKey: 'orig_1',
  productId: 'pro_monthly',
  periodEnd: at(30),
  ...over,
})

const state = (over: Partial<SubscriptionState> = {}): SubscriptionState => ({
  status: 'active',
  productId: 'pro_monthly',
  currentPeriodEnd: at(30),
  autoRenew: true,
  lastEventAt: at(0),
  ...over,
})

describe('A replayed notification changes nothing (§V)', () => {
  it('drops an event it has already applied', () => {
    expect(apply(state(), event({ eventId: 'evt_1' }), ['evt_1'])).toEqual({
      applied: false,
      why: 'already_seen',
    })
  })

  it('applies the same SHAPE of event under a new id, because it is a new event', () => {
    // Two genuine renewals look identical apart from their ids. Deduping on
    // anything but the id would silently swallow a real month.
    const outcome = apply(state(), event({ eventId: 'evt_2', kind: 'renewed', at: at(30) }), [
      'evt_1',
    ])
    expect(outcome.applied).toBe(true)
  })
})

describe('An out-of-order notification changes nothing (§V)', () => {
  it('drops a retry of an older event that arrives after a newer one', () => {
    // The failure this prevents: a retried DID_RENEW landing after the
    // EXPIRED that followed it, resurrecting a dead subscription and handing
    // out a month nobody paid for.
    const expired = state({ status: 'expired', lastEventAt: at(40) })
    const stale = event({ eventId: 'evt_late', kind: 'renewed', at: at(30) })

    expect(apply(expired, stale, [])).toEqual({ applied: false, why: 'older_than_state' })
  })

  it('judges order by the store clock, not by arrival', () => {
    const current = state({ lastEventAt: at(10) })
    expect(apply(current, event({ eventId: 'a', at: at(9) }), []).applied).toBe(false)
    expect(apply(current, event({ eventId: 'b', at: at(11) }), []).applied).toBe(true)
  })

  it('accepts anything at all when there is no state yet', () => {
    expect(apply(null, event({ at: at(-500) }), []).applied).toBe(true)
  })
})

describe('What each event means', () => {
  const applied = (kind: EventKind, over: Partial<StoreEvent> = {}) => {
    const outcome = apply(null, event({ kind, ...over }), [])
    if (!outcome.applied) throw new Error(`expected ${kind} to apply`)
    return outcome.next
  }

  it('maps both stores onto the statuses the schema allows', () => {
    expect(applied('subscribed').status).toBe('active')
    expect(applied('trial_started').status).toBe('trial')
    expect(applied('renewed').status).toBe('active')
    expect(applied('billing_retry').status).toBe('grace')
    expect(applied('on_hold').status).toBe('on_hold')
    expect(applied('expired').status).toBe('expired')
  })

  it('keeps the period when somebody cancels (§U)', () => {
    // §U: "Downgrade/cancel keeps Pro until the paid period ends." Cancelling
    // is not an ending; it turns renewal off.
    const next = applied('cancelled', { periodEnd: at(30) })
    expect(next.status).toBe('cancelled')
    expect(next.currentPeriodEnd).toBe(at(30))
    expect(next.autoRenew).toBe(false)
  })

  it('ends the period NOW on a refund or a revocation', () => {
    // The money went back. Waiting for the period to run would be a month of
    // Pro paid for by nobody.
    for (const kind of ['refunded', 'revoked'] as const) {
      const next = applied(kind, { at: at(5), periodEnd: at(30) })
      expect(next.status, kind).toBe('expired')
      expect(next.currentPeriodEnd, kind).toBe(at(5))
      expect(next.autoRenew, kind).toBe(false)
    }
  })

  it('clears a hold when billing recovers', () => {
    const held = state({ status: 'on_hold', lastEventAt: at(1) })
    const outcome = apply(held, event({ eventId: 'r', kind: 'recovered', at: at(2) }), [])
    if (!outcome.applied) throw new Error('expected recovery to apply')
    expect(outcome.next.status).toBe('active')
    expect(outcome.next.autoRenew).toBe(true)
  })

  it('keeps the period it already had when an event states none', () => {
    const current = state({ currentPeriodEnd: at(30) })
    const outcome = apply(current, event({ eventId: 'x', kind: 'billing_retry', at: at(31) }), [])
    if (!outcome.applied) throw new Error('expected it to apply')
    // Dropping the date here would expire somebody the moment their card was
    // retried.
    expect(outcome.next.currentPeriodEnd).toBe(at(30))
  })
})

describe('The entitlement a company ends up with (§U)', () => {
  it('is Pro while any rail is paid up, and takes the furthest date', () => {
    // §U: "one company, one plan, whichever rail paid for it." An Apple
    // subscription that lapsed does not cancel a web one that did not.
    const result = entitlementFrom(
      [
        state({ status: 'expired', currentPeriodEnd: at(-10) }),
        state({ status: 'active', currentPeriodEnd: at(20) }),
      ],
      14,
      NOW,
    )
    expect(result.plan).toBe('pro')
    expect(result.validUntil).toBe(at(20))
  })

  it('adds the grace window past the paid period, and not before it', () => {
    const result = entitlementFrom([state({ currentPeriodEnd: at(10) })], 14, NOW)
    expect(result.graceUntil).toBe(at(24))
  })

  it('is Free when every period has run out', () => {
    const result = entitlementFrom(
      [state({ status: 'cancelled', currentPeriodEnd: at(-1) })],
      14,
      NOW,
    )
    expect(result).toEqual({ plan: 'free' })
  })

  it('is Free for a company with no subscription at all', () => {
    expect(entitlementFrom([], 14, NOW)).toEqual({ plan: 'free' })
  })

  it('gives a refunded subscription nothing, however far off its period was', () => {
    const refunded = state({ status: 'expired', currentPeriodEnd: at(5) })
    expect(entitlementFrom([refunded], 14, NOW)).toEqual({ plan: 'free' })
  })
})
