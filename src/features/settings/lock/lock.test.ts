/**
 * The app lock never becomes the reason records are unreachable (Rule #6).
 *
 * "Documents are never hostage" is written in CLAUDE.md about subscriptions,
 * and the same sentence decides this feature. A lock whose key has vanished —
 * biometrics wiped, screen lock removed in Android settings — is
 * indistinguishable from data loss from where the owner is standing. So the
 * lock turns itself off and the app opens.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  type Authenticator,
  type LockAvailability,
  DEFAULT_LOCK,
  attemptUnlock,
  lockOffer,
  shouldLock,
} from './lock'

const authenticator = (
  availability: LockAvailability,
  outcome: Awaited<ReturnType<Authenticator['authenticate']>> = 'unlocked',
): Authenticator => ({
  availability: async () => availability,
  authenticate: vi.fn(async () => outcome),
})

describe('The default', () => {
  it('is off (§Q Phase 4)', () => {
    // Not "off until we suggest it". A shop owner handing their phone across
    // a counter twenty times a day does not want twenty prompts.
    expect(DEFAULT_LOCK.enabled).toBe(false)
  })

  it('has a grace window long enough to answer a call mid-invoice', () => {
    // Zero would lock on every glance at a notification, which is how people
    // turn a security feature off for good.
    expect(DEFAULT_LOCK.graceSeconds).toBeGreaterThanOrEqual(15)
    expect(DEFAULT_LOCK.graceSeconds).toBeLessThanOrEqual(60)
  })
})

describe('shouldLock', () => {
  const enabled = { enabled: true, graceSeconds: 30 }

  it('never locks when the setting is off', () => {
    expect(shouldLock(DEFAULT_LOCK, null, 0)).toBe(false)
    expect(shouldLock(DEFAULT_LOCK, 0, 10_000_000)).toBe(false)
  })

  it('locks on a cold start', () => {
    // The grace window is for an owner glancing away, not for whoever picks
    // the phone up next.
    expect(shouldLock(enabled, null, 1_000)).toBe(true)
  })

  it('stays unlocked inside the grace window', () => {
    expect(shouldLock(enabled, 1_000, 1_000 + 29_000)).toBe(false)
  })

  it('locks once the window has passed', () => {
    expect(shouldLock(enabled, 1_000, 1_000 + 30_000)).toBe(true)
  })
})

describe('When the phone can no longer authenticate', () => {
  it('turns the lock off rather than sealing the app', async () => {
    const result = await attemptUnlock(
      authenticator({ kind: 'none', reason: 'No screen lock is set on this phone.' }),
      { enabled: true, graceSeconds: 30 },
      'Unlock DocFlow',
    )

    expect(result.outcome).toBe('unavailable')
    expect(result.settings?.enabled).toBe(false)
  })

  it('does the same when the prompt itself reports it is unavailable', async () => {
    const result = await attemptUnlock(
      authenticator({ kind: 'biometric', label: 'Fingerprint' }, 'unavailable'),
      { enabled: true, graceSeconds: 30 },
      'Unlock DocFlow',
    )
    expect(result.settings?.enabled).toBe(false)
  })

  it('does not prompt at all when there is nothing to prompt with', async () => {
    const auth = authenticator({ kind: 'none', reason: 'No screen lock.' })
    await attemptUnlock(auth, { enabled: true, graceSeconds: 30 }, 'Unlock DocFlow')
    expect(auth.authenticate).not.toHaveBeenCalled()
  })
})

describe('An ordinary refusal is not a failure of the lock', () => {
  it('leaves the setting alone when the owner cancels', async () => {
    const result = await attemptUnlock(
      authenticator({ kind: 'biometric', label: 'Fingerprint' }, 'cancelled'),
      { enabled: true, graceSeconds: 30 },
      'Unlock DocFlow',
    )
    expect(result.outcome).toBe('cancelled')
    // Still on: they backed out, they did not ask to remove the lock.
    expect(result.settings).toBeUndefined()
  })

  it('leaves the setting alone after a wrong finger', async () => {
    const result = await attemptUnlock(
      authenticator({ kind: 'biometric', label: 'Fingerprint' }, 'failed'),
      { enabled: true, graceSeconds: 30 },
      'Unlock DocFlow',
    )
    expect(result.outcome).toBe('failed')
    expect(result.settings).toBeUndefined()
  })
})

describe('What Settings may offer', () => {
  it('offers the lock where a biometric is enrolled', () => {
    expect(lockOffer({ kind: 'biometric', label: 'Fingerprint' })).toEqual({
      canEnable: true,
      explanation: null,
    })
  })

  it('offers it with the PIN, and says that is what will appear', () => {
    const offer = lockOffer({ kind: 'device_credential' })
    expect(offer.canEnable).toBe(true)
    expect(offer.explanation).toMatch(/PIN or pattern/)
  })

  it('refuses to offer what the phone cannot do, and says why (§N)', () => {
    const offer = lockOffer({ kind: 'none', reason: 'No screen lock is set on this phone.' })
    expect(offer.canEnable).toBe(false)
    // An unavailable capability is stated plainly, never dressed up or
    // silently hidden — the same rule as an unavailable model.
    expect(offer.explanation).toBe('No screen lock is set on this phone.')
  })
})
