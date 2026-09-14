/**
 * The optional app lock (§Q Phase 4, Rule #6, §P).
 *
 * §Q: "optional biometric/PIN lock (default off)". Three words in that line do
 * all the work, and each one is a rule this file keeps.
 *
 * **Optional.** It gates the SCREENS, not the database. The SQLCipher
 * passphrase is deliberately not tied to a fingerprint (`src/data/sqlite/key.ts`
 * says why): a wet thumb or a cracked sensor must never be the reason an owner
 * cannot reach records that are already on their own phone. Rule #6 — documents
 * are never hostage — is not only about subscriptions.
 *
 * **Default off.** Not "off until we suggest it", not "off but prompted on
 * first launch". A shop owner handing their phone across a counter twenty
 * times a day does not want a fingerprint prompt twenty times a day, and Rule
 * #1 says nothing may be harder than the legacy app. Somebody who wants it
 * turns it on.
 *
 * **Never a dead end.** Every lock needs an escape that does not depend on the
 * hardware working. If biometrics are unavailable — not enrolled, temporarily
 * locked out after failed attempts, sensor broken — the lock falls back to the
 * device credential (PIN, pattern, password). If the platform cannot offer
 * either, the lock DISABLES ITSELF rather than sealing the app: a lock the
 * owner cannot open is indistinguishable from data loss.
 */

export type LockAvailability =
  /** A fingerprint or face is enrolled and usable. */
  | { readonly kind: 'biometric'; readonly label: string }
  /** No biometric, but the phone has a PIN, pattern or password. */
  | { readonly kind: 'device_credential' }
  /** Nothing to lock with. The setting cannot be offered, and says why. */
  | { readonly kind: 'none'; readonly reason: string }

export type UnlockOutcome =
  | 'unlocked'
  /** The owner backed out. The app stays locked; nothing is wrong. */
  | 'cancelled'
  /** Wrong finger, too many times. Retryable, and the message says how. */
  | 'failed'
  /**
   * The platform can no longer authenticate at all — biometrics wiped, screen
   * lock removed. The lock turns itself OFF and the app opens (see above).
   */
  | 'unavailable'

export interface LockSettings {
  /** §Q: default off. */
  readonly enabled: boolean
  /**
   * How long the app may be in the background before it locks again.
   *
   * Zero would lock on every glance at a notification, which is how people
   * turn a security feature off for good. Thirty seconds covers answering a
   * call or checking a message mid-invoice.
   */
  readonly graceSeconds: number
}

export const DEFAULT_LOCK: LockSettings = { enabled: false, graceSeconds: 30 }

/**
 * Should the app be locked right now?
 *
 * A pure function of the settings, when the app was last backgrounded, and
 * now — so the whole policy is testable without a sensor, and so "did it lock
 * when it should" is a question with one answer rather than a race between
 * lifecycle events.
 *
 * `backgroundedAt === null` means the app has just cold-started, and a cold
 * start always locks: the grace window is for an owner glancing away, not for
 * whoever picks the phone up next.
 */
export function shouldLock(
  settings: LockSettings,
  backgroundedAt: number | null,
  now: number,
): boolean {
  if (!settings.enabled) return false
  if (backgroundedAt === null) return true
  return now - backgroundedAt >= settings.graceSeconds * 1_000
}

export interface Authenticator {
  availability(): Promise<LockAvailability>
  /** Prompts. Resolves with what happened — never throws for a refusal. */
  authenticate(reason: string): Promise<UnlockOutcome>
}

export interface UnlockResult {
  readonly outcome: UnlockOutcome
  /** Set when the lock turned itself off because it could no longer open. */
  readonly settings?: LockSettings
}

/**
 * One attempt at unlocking.
 *
 * The `unavailable` branch is the reason this is a function rather than a call
 * to the plugin: an owner who removes their screen lock in Android settings
 * has, without meaning to, removed the only key to their own records. The app
 * notices, turns the lock off, opens, and can then tell them — which is the
 * only behaviour compatible with Rule #6.
 */
export async function attemptUnlock(
  authenticator: Authenticator,
  settings: LockSettings,
  reason: string,
): Promise<UnlockResult> {
  const availability = await authenticator.availability()
  if (availability.kind === 'none') {
    return { outcome: 'unavailable', settings: { ...settings, enabled: false } }
  }

  const outcome = await authenticator.authenticate(reason)
  if (outcome === 'unavailable') {
    return { outcome, settings: { ...settings, enabled: false } }
  }
  return { outcome }
}

/** Whether the setting may be offered at all, and the words if not (§N). */
export function lockOffer(availability: LockAvailability): {
  readonly canEnable: boolean
  readonly explanation: string | null
} {
  switch (availability.kind) {
    case 'biometric':
      return { canEnable: true, explanation: null }
    case 'device_credential':
      // Offered, and honest about what will actually appear.
      return { canEnable: true, explanation: 'Your phone will ask for its PIN or pattern.' }
    case 'none':
      // §N's rule, applied to a sensor rather than a model: an unavailable
      // capability is stated plainly, never dressed up or silently hidden.
      return { canEnable: false, explanation: availability.reason }
  }
}
