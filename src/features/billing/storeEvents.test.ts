/**
 * Translating two stores into one vocabulary (§U, §V).
 *
 * Imported from the edge function's own source, the way the payment
 * webhook's rules are: a copy in `src/` would be a second answer to the same
 * question, and the one that ships would be the untested one.
 */

import { describe, expect, it } from 'vitest'

import {
  UNVERIFIED_REASON,
  appleKind,
  googleKind,
  isPlatform,
  normaliseApple,
  normaliseGoogle,
  routeOf,
  verified,
} from '../../../supabase/functions/store-notifications/rules'

const COMPANY = '11111111-1111-1111-1111-111111111111'

describe('Which company, which store', () => {
  it('reads the platform and the company from the path', () => {
    expect(routeOf(`/store-notifications/apple/${COMPANY}`)).toEqual({
      platform: 'apple',
      companyId: COMPANY,
    })
    expect(routeOf(`/store-notifications/google/${COMPANY}`)?.platform).toBe('google')
  })

  it('refuses anything that is not a platform and a real id', () => {
    expect(routeOf(`/store-notifications/stripe/${COMPANY}`)).toBeNull()
    expect(routeOf('/store-notifications/apple/co_1')).toBeNull()
    expect(routeOf('/store-notifications/apple')).toBeNull()
    expect(routeOf(`/elsewhere/apple/${COMPANY}`)).toBeNull()
    expect(isPlatform('web')).toBe(false)
  })
})

describe('Apple’s vocabulary', () => {
  it('separates a first subscription from a resubscription', () => {
    expect(appleKind('SUBSCRIBED', 'INITIAL_BUY')).toBe('trial_started')
    expect(appleKind('SUBSCRIBED', 'RESUBSCRIBE')).toBe('subscribed')
  })

  it('separates an ordinary renewal from a billing recovery', () => {
    // Collapsing these loses the state that must clear an on-hold.
    expect(appleKind('DID_RENEW')).toBe('renewed')
    expect(appleKind('DID_RENEW', 'BILLING_RECOVERY')).toBe('recovered')
  })

  it('separates a grace period from a hold', () => {
    expect(appleKind('DID_FAIL_TO_RENEW', 'GRACE_PERIOD')).toBe('billing_retry')
    expect(appleKind('DID_FAIL_TO_RENEW')).toBe('on_hold')
  })

  it('reads cancel and resume out of one notification type', () => {
    expect(appleKind('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED')).toBe('cancelled')
    expect(appleKind('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_ENABLED')).toBe('renewed')
  })

  it('knows the ones that end a plan immediately', () => {
    expect(appleKind('REFUND')).toBe('refunded')
    expect(appleKind('REVOKE')).toBe('revoked')
    expect(appleKind('EXPIRED')).toBe('expired')
  })

  it('returns null for a type it has never heard of', () => {
    // Better a parked event than a guessed one: Apple adds types.
    expect(appleKind('SOMETHING_NEW')).toBeNull()
  })

  it('normalises a whole notification', () => {
    const event = normaliseApple({
      notificationType: 'DID_RENEW',
      notificationUUID: 'uuid-1',
      signedDate: 1_789_000_000_000,
      data: {
        originalTransactionId: 'orig_1',
        productId: 'pro_monthly',
        expiresDate: 1_791_000_000_000,
      },
    })

    expect(event).toEqual({
      platform: 'apple',
      eventId: 'uuid-1',
      at: new Date(1_789_000_000_000).toISOString(),
      kind: 'renewed',
      subscriptionKey: 'orig_1',
      productId: 'pro_monthly',
      periodEnd: new Date(1_791_000_000_000).toISOString(),
    })
  })

  it('refuses a notification with no id, rather than minting one', () => {
    // Our own id would be minted per delivery, so a retry would mint a second
    // — and idempotence would be gone.
    expect(normaliseApple({ notificationType: 'DID_RENEW', data: {} })).toBeNull()
  })
})

describe('Google’s vocabulary', () => {
  it('maps the numbers the API actually sends', () => {
    expect(googleKind(1)).toBe('recovered')
    expect(googleKind(2)).toBe('renewed')
    expect(googleKind(3)).toBe('cancelled')
    expect(googleKind(4)).toBe('subscribed')
    expect(googleKind(5)).toBe('on_hold')
    expect(googleKind(6)).toBe('billing_retry')
    expect(googleKind(12)).toBe('revoked')
    expect(googleKind(13)).toBe('expired')
    expect(googleKind(99)).toBeNull()
  })

  it('takes the purchase token as the subscription identity', () => {
    const event = normaliseGoogle(
      {
        eventTimeMillis: '1789000000000',
        subscriptionNotification: {
          notificationType: 2,
          purchaseToken: 'tok_1',
          subscriptionId: 'pro_annual',
        },
      },
      'msg_1',
    )

    expect(event?.subscriptionKey).toBe('tok_1')
    expect(event?.kind).toBe('renewed')
    expect(event?.eventId).toBe('msg_1')
    // Google states no expiry in the notification — it is fetched from the
    // Play Developer API with a service account. Absent, never guessed.
    expect(event?.periodEnd).toBeUndefined()
  })

  it('refuses a push with no message id', () => {
    expect(
      normaliseGoogle({ subscriptionNotification: { notificationType: 2 } }, ''),
    ).toBeNull()
  })
})

describe('The door, which is shut', () => {
  it('verifies nothing on either platform, and says why', () => {
    // Neither signature can be checked honestly without an account to test
    // against. An unexercised verifier standing between a stranger and a paid
    // plan is worse than a closed door.
    const request = { headers: new Headers(), raw: '{}' }
    expect(verified('apple', request)).toBe(false)
    expect(verified('google', request)).toBe(false)

    expect(UNVERIFIED_REASON.apple).toContain('sandbox notification')
    expect(UNVERIFIED_REASON.google).toContain('audience')
  })
})
