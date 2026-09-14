/**
 * When DocFlow may ask to be rated (§T, §N; Apple 3.2.2(x)).
 *
 * §T: "ratings prompts appear only at happy moments."
 *
 * The whole file is about the word ONLY. Every store's review API already
 * rate-limits the prompt itself — the system decides whether anything appears,
 * and an app that asks too often simply burns its allowance in silence. So
 * nothing here counts prompts to obey a store; it counts them because a
 * request the system swallows is a request wasted, and because the moment is
 * ours to choose even when the showing is not.
 *
 * The moment §T names is a share that worked. That is the one point in this
 * app where somebody has just finished the thing they came to do: the invoice
 * is made, it is signed, it is out. Everything else in here is a reason NOT to
 * ask, and the reasons are the substance:
 *
 * · never after an error, a void, a credit note or a deletion — the three
 *   places somebody is already unhappy;
 * · never on a first run: §R's sample is not an achievement, and "rate us"
 *   before the app has done anything for you is the prompt everybody hates;
 * · never while the account is scheduled for deletion, which would be asking
 *   somebody on their way out the door what they think of the place;
 * · never in a demo (§R: a demo is not an account);
 * · never gated — Apple 3.2.2(x) forbids withholding functionality pending a
 *   rating, and nothing in DocFlow is behind this.
 *
 * The state is PER DEVICE and never goes near the outbox, for the same reason
 * the theme choice does not: it is about this phone and the person holding it,
 * not about the company.
 */

/** Shares that must have worked before the first ask. */
export const SHARES_BEFORE_ASKING = 3

/** Days between asks, on top of whatever the platform enforces. */
export const DAYS_BETWEEN_ASKS = 120

/** How many times this device will ever be asked. */
export const MOST_ASKS_EVER = 3

const DAY_MS = 86_400_000

/**
 * What just happened. Only one of these is a happy moment, and naming the
 * unhappy ones is the point: a call site that passes `void_recorded` cannot
 * accidentally read as a share.
 */
export type Moment =
  | 'share_handed_off'
  | 'share_failed'
  | 'document_issued'
  | 'void_recorded'
  | 'credit_note_recorded'
  | 'payment_recorded'
  | 'account_deletion_requested'

export interface PromptState {
  /** Successful shares seen on this device, ever. */
  readonly shares: number
  /** ISO instant of the last ask, absent if never asked. */
  readonly lastAskedAt?: string
  readonly asks: number
}

export const NEVER_ASKED: PromptState = { shares: 0, asks: 0 }

export interface Context {
  readonly state: PromptState
  readonly moment: Moment
  readonly now: Date
  /** §R: a demo is not an account, and a sample is not an achievement. */
  readonly isDemo: boolean
  /** Asking somebody who is leaving is the worst version of this prompt. */
  readonly deletionScheduled: boolean
  /** The platform may have no review API at all — the web, today (§N). */
  readonly available: boolean
}

export type Refusal =
  | 'not_a_happy_moment'
  | 'too_few_shares'
  | 'asked_too_recently'
  | 'asked_enough'
  | 'demo'
  | 'leaving'
  | 'unavailable'

export type Decision = { readonly ask: true } | { readonly ask: false; readonly why: Refusal }

const no = (why: Refusal): Decision => ({ ask: false, why })

/**
 * The order matters, and it is not arbitrary: the reasons a person would find
 * insulting come first, so a log of refusals reads as "we did not ask because
 * they are leaving" rather than "we did not ask because the counter was low".
 */
export function decide(context: Context): Decision {
  if (context.isDemo) return no('demo')
  if (context.deletionScheduled) return no('leaving')
  if (!context.available) return no('unavailable')
  if (context.moment !== 'share_handed_off') return no('not_a_happy_moment')

  const { shares, asks, lastAskedAt } = context.state
  if (shares < SHARES_BEFORE_ASKING) return no('too_few_shares')
  if (asks >= MOST_ASKS_EVER) return no('asked_enough')

  if (lastAskedAt !== undefined) {
    const since = context.now.getTime() - new Date(lastAskedAt).getTime()
    // A date in the future is a clock that moved, not a recent ask. Treating
    // it as recent would silence the prompt until the clock caught up.
    if (Number.isNaN(since)) return no('asked_too_recently')
    if (since >= 0 && since < DAYS_BETWEEN_ASKS * DAY_MS) return no('asked_too_recently')
  }

  return { ask: true }
}

/** A share that worked, counted. Nothing else moves this number. */
export function afterShare(state: PromptState, moment: Moment): PromptState {
  return moment === 'share_handed_off' ? { ...state, shares: state.shares + 1 } : state
}

/**
 * Recorded when the app ASKS, never when somebody rates.
 *
 * There is nothing to record about the rating: the system's prompt reports no
 * outcome, by design, so an app cannot know whether a star was given or the
 * sheet was dismissed. A field for it would be a field that can only ever be
 * a guess.
 */
export function afterAsking(state: PromptState, now: Date): PromptState {
  return { ...state, asks: state.asks + 1, lastAskedAt: now.toISOString() }
}
