/**
 * Deleting an account (§S, §V, Rule #6; Apple 5.1.1(v)).
 *
 * The store-policy pass found this missing: DocFlow offers account creation
 * and offered no way out, which Apple's rule makes a submission blocker. The
 * rule, read on 2026-09-14, is quoted in `src/marketing/policy/questions.ts`
 * and the two clauses that shape this file are:
 *
 *   "Offer to delete the entire account record, along with associated
 *    personal data ... only offering to temporarily deactivate or disable an
 *    account is insufficient."
 *
 *   "If your process for account deletion is manual or otherwise takes time
 *    to complete, this is acceptable. Inform the user how long it will take
 *    and provide a confirmation when the deletion has been completed."
 *
 * So deletion here is SCHEDULED, not instant, and the window belongs to the
 * person leaving rather than to us. Thirty days is long enough to notice a
 * mistake — an angry evening, a staff member with the owner's phone, a
 * mis-tap — and short enough that it is still a deletion. Nobody at DocFlow
 * can read the account during it: the window is a delay, not a holding pen,
 * and there is no new read path for anybody.
 *
 * **Why there is no six-month admin-readable copy.** It would be the thing
 * the rule above calls insufficient — a deactivation with extra steps — and
 * two launch markets are in the EU, where erasure is a right and "an
 * administrator might want it" is not a lawful basis for keeping somebody's
 * invoices. It would also invert Rule #6: documents are never hostage, and a
 * company that keeps your records after you leave is holding them just the
 * same. What the instinct actually wants is served instead by the grace
 * window (recover from a mistake), by the export the flow refuses to skip
 * (the owner walks away holding everything), and by the tombstone below
 * (support can still answer "was this deleted, and when").
 */

/**
 * The window, in days.
 *
 * One constant, deliberately: it is the number a person is told, the number
 * the purge counts to, and the number a regulator would ask about, so it must
 * not be able to differ between them.
 */
export const GRACE_DAYS = 30

export type Role = 'owner' | 'admin' | 'staff'

export interface DeletionRequest {
  readonly companyId: string
  /** The user who asked. Kept so the tombstone can say who, without saying who they are. */
  readonly requestedBy: string
  readonly requestedAt: string
  /** Nothing is destroyed before this instant. */
  readonly purgeAfter: string
  /**
   * Did the owner take the archive on the way out?
   *
   * Recorded rather than required: Rule #6 says export is free forever, not
   * that leaving is conditional on it. The flow OFFERS it and cannot be
   * skipped silently; an owner who declines is still allowed to leave.
   */
  readonly exported: boolean
}

/**
 * What is left when the purge has run.
 *
 * No name, no email, no document, no amount, no customer — ids and dates
 * only. This is what lets somebody answer "was this account deleted, and
 * when" a year later without having kept the account.
 */
export interface Tombstone {
  readonly companyId: string
  readonly requestedBy: string
  readonly requestedAt: string
  readonly purgedAt: string
}

export type Lifecycle =
  | { readonly state: 'active' }
  | { readonly state: 'scheduled'; readonly request: DeletionRequest }
  | { readonly state: 'purged'; readonly tombstone: Tombstone }

export type Refusal =
  | 'not_owner'
  | 'name_mismatch'
  | 'already_scheduled'
  | 'not_scheduled'
  | 'too_early'

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly why: Refusal }

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const no = <T,>(why: Refusal): Result<T> => ({ ok: false, why })

const DAY_MS = 86_400_000

/**
 * Only an owner. §P puts staff permissions on the server, and this is the one
 * action no permission should ever grant: an admin who can delete the company
 * is an admin who can end the business's records in an afternoon.
 */
export const canRequest = (role: Role): boolean => role === 'owner'

/**
 * Typing the business name is the confirmation.
 *
 * Not a checkbox, and not "type DELETE": the name is the thing being ended,
 * it is different for every company, and it cannot be produced by muscle
 * memory or by a mis-tap. Compared case-insensitively and trimmed, because
 * the test is intent, not typing accuracy.
 */
export const confirms = (typed: string, companyName: string): boolean =>
  typed.trim().toLocaleLowerCase() === companyName.trim().toLocaleLowerCase() &&
  companyName.trim() !== ''

export function requestDeletion(input: {
  readonly lifecycle: Lifecycle
  readonly companyId: string
  readonly companyName: string
  readonly requestedBy: string
  readonly role: Role
  readonly typedName: string
  readonly exported: boolean
  readonly now: Date
}): Result<DeletionRequest> {
  if (!canRequest(input.role)) return no('not_owner')
  if (input.lifecycle.state === 'scheduled') return no('already_scheduled')
  if (!confirms(input.typedName, input.companyName)) return no('name_mismatch')

  return ok({
    companyId: input.companyId,
    requestedBy: input.requestedBy,
    requestedAt: input.now.toISOString(),
    purgeAfter: new Date(input.now.getTime() + GRACE_DAYS * DAY_MS).toISOString(),
    exported: input.exported,
  })
}

/**
 * Cancelling needs no typed name and no ceremony.
 *
 * Asymmetry on purpose: the destructive direction is slow and deliberate, the
 * recovering direction is one tap. Anything else punishes the mistake the
 * window exists to catch.
 */
export function cancelDeletion(lifecycle: Lifecycle, role: Role): Result<Lifecycle> {
  if (!canRequest(role)) return no('not_owner')
  if (lifecycle.state !== 'scheduled') return no('not_scheduled')
  return ok({ state: 'active' })
}

export const isPurgeDue = (request: DeletionRequest, now: Date): boolean =>
  now.getTime() >= new Date(request.purgeAfter).getTime()

/** Whole days left, floored, and never below zero. */
export function daysLeft(request: DeletionRequest, now: Date): number {
  const remaining = new Date(request.purgeAfter).getTime() - now.getTime()
  return Math.max(0, Math.ceil(remaining / DAY_MS))
}

/**
 * The purge, as a rule rather than as SQL.
 *
 * Refuses to run early — the one-sentence version of "nothing is destroyed
 * before the date the person was given". The migration enforces the same
 * thing; this exists so the rule is testable without a database.
 */
export function purge(request: DeletionRequest, now: Date): Result<Tombstone> {
  if (!isPurgeDue(request, now)) return no('too_early')
  return ok({
    companyId: request.companyId,
    requestedBy: request.requestedBy,
    requestedAt: request.requestedAt,
    purgedAt: now.toISOString(),
  })
}

/**
 * Every field a tombstone may carry, as data.
 *
 * A list, so a test can assert that nothing else ever joins it — the way a
 * "temporary" column for a name or an email would.
 */
export const TOMBSTONE_FIELDS = ['companyId', 'requestedBy', 'requestedAt', 'purgedAt'] as const
