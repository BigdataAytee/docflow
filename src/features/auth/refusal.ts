/**
 * What the app says when signing in is refused (§P, §R, §S, Rule #4).
 *
 * The limiter on auth belongs to the provider (see `src/domain/auth/limits`),
 * but what a person READS when it fires belongs to us — and until now it was
 * GoTrue's own English, thrown straight onto the screen:
 *
 *     throw new AuthError(error.message)   →   "Email rate limit exceeded"
 *
 * Three things wrong with that, each its own rule. It is a hardcoded English
 * string in a product that ships seven locales (§D). It is jargon at the
 * worst possible moment (§S — plain words, and never the machine's). And it
 * leaks how the system is built to whoever is probing it (§P).
 *
 * So a failure is classified into the small set of things that can actually
 * have happened, and the screen says one of OUR sentences about it.
 *
 * The classification is ordered deliberately: status first, because 429 is
 * unambiguous and the same in every deployment; the provider's error CODE
 * next; the message text last and only as a hint, because it is English that
 * changes between releases and a classifier that leans on it goes quietly
 * wrong on an upgrade.
 */

import type { UiStrings } from '../../domain/locale/data/strings'
import { format } from '../../domain/locale/data/strings'

export type AuthRefusal =
  /** The provider refused because too many requests arrived. */
  | { readonly kind: 'rate_limited'; readonly retryAfterSeconds: number | null }
  /**
   * The email and password do not match. ONE outcome for "no such account"
   * and "wrong password" both, because telling them apart tells a stranger
   * which addresses are registered (§P).
   */
  | { readonly kind: 'bad_credentials' }
  /**
   * The account exists and the password is right, but the address has never
   * been confirmed. Its own outcome because the ACTION is different: nothing
   * typed on this screen will fix it, and the thing that will is sitting in
   * an inbox.
   */
  | { readonly kind: 'email_unconfirmed' }
  /**
   * The project is not configured for what was asked — a provider that is not
   * enabled, sign-ups turned off. "Try again" is actively wrong advice: it
   * will fail identically forever, and only an owner can change that.
   */
  | { readonly kind: 'unavailable' }
  /** The request never arrived. §R already says auth needs a connection. */
  | { readonly kind: 'offline' }
  | { readonly kind: 'unknown' }

/** Whatever supabase-js hands back, read defensively. */
interface MaybeAuthError {
  readonly status?: unknown
  readonly code?: unknown
  /**
   * GoTrue's body names the refusal here, not in `code` — `code` is the HTTP
   * status as a number. Read both so a raw body classifies the same as the
   * error the client wraps it in.
   */
  readonly error_code?: unknown
  readonly name?: unknown
  readonly message?: unknown
  readonly msg?: unknown
  readonly retryAfter?: unknown
}

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

export function classifyAuthFailure(cause: unknown): AuthRefusal {
  const error = (cause ?? {}) as MaybeAuthError
  const text = typeof error.message === 'string' ? error.message : (error.msg ?? '')
  const message = typeof text === 'string' ? text.toLowerCase() : ''
  const named = typeof error.code === 'string' ? error.code : error.error_code
  const code = typeof named === 'string' ? named.toLowerCase() : ''

  // 1. The status. Unambiguous, and identical in every deployment.
  if (error.status === 429) {
    return { kind: 'rate_limited', retryAfterSeconds: asNumber(error.retryAfter) }
  }

  // 2. The provider's code. Stable across releases in a way prose is not.
  if (code.includes('rate_limit') || code.includes('rate limit')) {
    return { kind: 'rate_limited', retryAfterSeconds: asNumber(error.retryAfter) }
  }
  if (code === 'invalid_credentials' || code === 'invalid_grant') {
    return { kind: 'bad_credentials' }
  }
  if (code === 'email_not_confirmed') return { kind: 'email_unconfirmed' }
  /*
   * `validation_failed` is what GoTrue answers for "Unsupported provider:
   * provider is not enabled" — the refusal that made "Continue with Google"
   * a button with no working outcome. `provider_disabled` and `signup_disabled`
   * are the same shape of answer: a setting, not an attempt.
   */
  if (
    code === 'validation_failed' ||
    code === 'provider_disabled' ||
    code === 'signup_disabled' ||
    code === 'email_provider_disabled'
  ) {
    return { kind: 'unavailable' }
  }

  // 3. A network failure never reached a status at all. `TypeError: Failed to
  //    fetch` is what a browser throws with no connection.
  if (error.name === 'TypeError' || message.includes('failed to fetch') || message.includes('network')) {
    return { kind: 'offline' }
  }

  // 4. The message, last, as a hint only.
  if (message.includes('rate limit')) return { kind: 'rate_limited', retryAfterSeconds: null }
  if (message.includes('invalid login credentials')) return { kind: 'bad_credentials' }
  if (message.includes('email not confirmed')) return { kind: 'email_unconfirmed' }
  if (message.includes('not enabled') || message.includes('unsupported provider')) {
    return { kind: 'unavailable' }
  }

  return { kind: 'unknown' }
}

/**
 * A wait a person can act on.
 *
 * Rounded UP to the minute once it is past one, because "try again in 1m 47s"
 * invites somebody to sit and count, and the provider's own clock is not ours
 * to be precise about. Under a minute stays in seconds: "in a few seconds" is
 * the truth and a minute would be a lie in the tedious direction.
 */
export const waitFrom = (seconds: number | null): string | null => {
  if (seconds === null || seconds <= 0) return null
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  return `${Math.ceil(seconds / 60)}m`
}

export function refusalMessage(refusal: AuthRefusal, strings: UiStrings): string {
  const a = strings.account
  switch (refusal.kind) {
    case 'rate_limited': {
      const wait = waitFrom(refusal.retryAfterSeconds)
      return wait === null ? a.tooManyTries : format(a.tooManyTriesIn, { wait })
    }
    case 'bad_credentials':
      return a.wrongDetails
    case 'email_unconfirmed':
      return a.confirmEmailFirst
    case 'unavailable':
      return a.signInUnavailable
    case 'offline':
      return a.needsConnection
    case 'unknown':
      return a.signInProblem
  }
}
