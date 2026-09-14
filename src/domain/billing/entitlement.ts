/**
 * What this company is entitled to, right now, offline (§U, Rule #6).
 *
 * §U: "Devices sync the entitlement as a signed, expiring payload cached in
 * SQLite. Pro features check the cache locally — so Pro works in airplane
 * mode — with a built-in offline grace window ... Past grace with no
 * successful refresh, the app degrades politely to Free: a calm one-line
 * notice, no data loss, no locked documents (Rule #6), everything restored on
 * the next successful check."
 *
 * Three things this file is careful about.
 *
 * **The client never decides what was bought.** It decides only whether a
 * payload it was GIVEN is still good. Everything here reads a cached
 * entitlement and a clock; nothing infers a purchase, and a device that has
 * never heard from the server is Free rather than optimistic.
 *
 * **Grace is not generosity, it is arithmetic.** `valid_until` is when the
 * paid period ends; `grace_until` is how long a device may keep working
 * without hearing from the server after that. An ordinary offline stretch
 * must never downgrade somebody mid-document, and past grace the answer is
 * Free with a sentence — never a locked screen.
 *
 * **Rule #6 sits above all of it.** Viewing, sharing and exporting existing
 * records are not features that happen to be free; they are never gated at
 * all, which is why `NEVER_GATED` is checked BEFORE the plan is even read.
 */

export type Plan = 'free' | 'pro'

/** What the server said, cached on the device. */
export interface CachedEntitlement {
  readonly plan: Plan
  /** End of the paid period. */
  readonly validUntil: string
  /** How long the device may keep going past that without a refresh. */
  readonly graceUntil: string
  /** The server's signature over the payload. Verified before this is stored. */
  readonly signedPayload: string
}

export type Standing =
  /** Paid, and current. */
  | { readonly plan: 'pro'; readonly standing: 'active' }
  /** The paid period ended; the device is inside the grace window. */
  | { readonly plan: 'pro'; readonly standing: 'grace'; readonly graceEndsAt: string }
  /** Nothing is owed and nothing is gated beyond the free line. */
  | { readonly plan: 'free'; readonly standing: 'free' }
  /** Was Pro; grace ran out without a refresh. Degraded, never locked. */
  | { readonly plan: 'free'; readonly standing: 'lapsed' }

/**
 * Everything Rule #6 puts out of reach of any plan, ever.
 *
 * A list rather than a convention, so a test can assert that no gate check
 * can be written against any of them — and so the day somebody proposes
 * gating export "just for trials", the change has to happen here, in front of
 * the rule it breaks.
 */
export const NEVER_GATED = [
  'view_document',
  'share_document',
  'export_archive',
  'render_pdf',
  'record_payment',
  'delete_account',
] as const

export type NeverGated = (typeof NEVER_GATED)[number]

const isNeverGated = (feature: string): feature is NeverGated =>
  (NEVER_GATED as readonly string[]).includes(feature)

const time = (iso: string): number => {
  const at = new Date(iso).getTime()
  return Number.isNaN(at) ? 0 : at
}

/**
 * Where this device stands.
 *
 * A cache that is absent, unreadable or unsigned is FREE — never Pro. The
 * failure direction matters: guessing Pro would hand out a paid plan to
 * anybody who corrupted a file, and guessing Free costs somebody a feature
 * until the next refresh, which is the mistake worth making.
 */
export function standing(cached: CachedEntitlement | null, now: Date): Standing {
  if (cached === null) return { plan: 'free', standing: 'free' }
  if (cached.signedPayload.trim() === '') return { plan: 'free', standing: 'free' }
  if (cached.plan !== 'pro') return { plan: 'free', standing: 'free' }

  const at = now.getTime()
  if (at < time(cached.validUntil)) return { plan: 'pro', standing: 'active' }
  if (at < time(cached.graceUntil)) {
    return { plan: 'pro', standing: 'grace', graceEndsAt: cached.graceUntil }
  }
  // Past grace, with no successful refresh. Free, and said in one line.
  return { plan: 'free', standing: 'lapsed' }
}

/**
 * May this company use this feature?
 *
 * `NEVER_GATED` first, before the plan is read at all, so no future edit to
 * the plan logic can reach the things Rule #6 protects.
 */
export function allowed(feature: string, at: Standing, proFeatures: readonly string[]): boolean {
  if (isNeverGated(feature)) return true
  if (!proFeatures.includes(feature)) return true
  return at.plan === 'pro'
}

/**
 * Does the app owe somebody a sentence about their plan?
 *
 * Only on the way DOWN, and only once a state is reached that a person would
 * otherwise discover by a feature quietly vanishing. Being Pro is not news.
 */
export function noticeFor(at: Standing): 'none' | 'grace' | 'lapsed' {
  if (at.standing === 'grace') return 'grace'
  if (at.standing === 'lapsed') return 'lapsed'
  return 'none'
}
