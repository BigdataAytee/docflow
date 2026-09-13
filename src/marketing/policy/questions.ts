/**
 * The half of store-policy verification that a person must do, and that this
 * file refuses to fake.
 *
 * §U: "Store steering/external-purchase policies change frequently and vary by
 * region: **verify the current rules at submission time in each store market**
 * rather than assuming today's."
 *
 * So nothing here states what a store's rule IS. Every entry names what
 * DocFlow does — a fact about our own code, which is knowable — and asks
 * whether the store currently permits it, in a named market. The answer comes
 * from a person who read the rule, and carries the URL they read and the date
 * they read it.
 *
 * **Answers expire.** That is the point of the whole file. "Verify at
 * submission time" is not satisfied by a checklist somebody ticked last
 * spring, and an answer with no expiry would become precisely the assumption
 * §U warns about — worse than no checklist, because it looks like diligence.
 * An expired answer reads as unanswered.
 */

/** How long an answer stands before it has to be read again. */
export const ANSWER_VALID_DAYS = 30

export type Store = 'apple' | 'play'

export interface PolicyQuestion {
  readonly id: string
  readonly store: Store
  /** What DocFlow does. A fact about our code, stated so the reader can judge it. */
  readonly whatWeDo: string
  /** What the reader must find out. Never what the answer is. */
  readonly question: string
  /** Where in the store's own documentation to look. */
  readonly lookIn: string
  /** Markets this must be answered for separately, if not all of them. */
  readonly perMarket: boolean
}

export const QUESTIONS: readonly PolicyQuestion[] = [
  {
    id: 'apple-subscriptions',
    store: 'apple',
    whatWeDo:
      'DocFlow Pro is a subscription sold through StoreKit 2 in the iOS app (§U), with a ' +
      'free tier that never expires and never locks existing documents.',
    question:
      'Is the plan as configured — its trial length, its price points per storefront, and ' +
      'the free tier alongside it — within the current subscription rules?',
    lookIn: 'App Review Guidelines, the In-App Purchase section, plus the current StoreKit docs',
    perMarket: true,
  },
  {
    id: 'apple-steering',
    store: 'apple',
    whatWeDo:
      'The same Pro plan is purchasable on the web (§U). The iOS app does not link to that ' +
      'purchase, mention a cheaper price elsewhere, or steer anybody off-platform.',
    question:
      'What may the app say about the web purchase in THIS storefront right now — nothing, ' +
      'a link, or a link behind a disclosure sheet?',
    lookIn:
      'App Review Guidelines on external purchase links, plus the storefront-specific ' +
      'entitlements. This is the rule that changes most often and differs most by region, ' +
      'so read it for the storefront being submitted to rather than for the one nearest.',
    perMarket: true,
  },
  {
    id: 'apple-privacy-label',
    store: 'apple',
    whatWeDo:
      'Data leaves the device only to the company’s own Supabase project. There is no ' +
      'analytics, attribution or advertising SDK, and §N keeps voice, scan and extraction ' +
      'on the device — all three checked against the code in `checks.ts`.',
    question:
      'Do the current privacy-label categories describe that accurately, and does anything ' +
      'in the declaration need to change for the way the questions are now worded?',
    lookIn: 'App Store Connect’s App Privacy questionnaire, as it currently reads',
    perMarket: false,
  },
  {
    id: 'apple-account-deletion',
    store: 'apple',
    whatWeDo:
      'An owner can export everything and delete their account in Settings (§S, Rule #6: ' +
      'export is free forever and documents are never held hostage).',
    question:
      'Does the in-app deletion flow meet the current requirement — its placement, what it ' +
      'must delete, and what it may keep?',
    lookIn: 'App Review Guidelines on account deletion',
    perMarket: false,
  },
  {
    id: 'apple-ratings-prompt',
    store: 'apple',
    whatWeDo:
      'The ratings prompt fires via the native review API after a successful share — a happy ' +
      'moment — never after an error, and is never gated behind anything (§T).',
    question: 'Is that timing and frequency within the current rules for the review API?',
    lookIn: 'App Review Guidelines on ratings and reviews, and the StoreKit review API docs',
    perMarket: false,
  },
  {
    id: 'play-billing',
    store: 'play',
    whatWeDo:
      'The same subscription, sold through Play Billing on Android (§U), with the same free ' +
      'tier and the same web rail.',
    question:
      'Is the plan within the current billing rules for this market, including any ' +
      'alternative-billing or user-choice programme that applies here?',
    lookIn: 'Play Console policy centre, the Payments policy',
    perMarket: true,
  },
  {
    id: 'play-data-safety',
    store: 'play',
    whatWeDo:
      'The same destinations as above, and the same absence of third-party SDKs — both ' +
      'derived from the code rather than remembered.',
    question:
      'Does the Data Safety form, as it currently reads, describe that — and does it ask ' +
      'anything the code has not been checked for?',
    lookIn: 'Play Console Data Safety form',
    perMarket: false,
  },
  {
    id: 'play-target-api',
    store: 'play',
    whatWeDo: 'The Android build targets whatever the Capacitor shell is configured for (Phase 4).',
    question: 'What is the minimum target API level for new submissions and for updates today?',
    lookIn: 'Play Console target API level requirements',
    perMarket: false,
  },
  {
    id: 'both-finance-category',
    store: 'apple',
    whatWeDo:
      'DocFlow records invoices, payments and receipts. It moves no money, holds no funds, ' +
      'and connects to no bank: a payment is a ledger record somebody typed (Rule #3).',
    question:
      'Does that put the app in a finance category with extra requirements in this market — ' +
      'and does the listing describe it in a way that avoids implying otherwise?',
    lookIn: 'App Review Guidelines on financial services; the equivalent Play financial-services policy',
    perMarket: true,
  },
]

/** The markets a listing ships to (§T's launch set, as store territories). */
export const SUBMISSION_MARKETS = ['NG', 'GH', 'GB', 'US', 'FR', 'ES', 'AE'] as const

export interface Answer {
  readonly questionId: string
  /** Empty for a question that is not per-market. */
  readonly market?: string
  readonly answer: string
  /** The page actually read. Not a guess at where the rule lives. */
  readonly source: string
  /** ISO date the reader read it. */
  readonly readAt: string
  readonly readBy: string
}

/**
 * Answers recorded so far.
 *
 * **Empty, and that is the honest state.** Nobody has read a store rule for
 * this app. Filling this in from memory — mine or anyone's — would be the
 * thing §U names: assuming today's rules, at exactly the moment the rules
 * matter most.
 */
export const ANSWERS: readonly Answer[] = []

export const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / 86_400_000)

export function isCurrent(answer: Answer, now: Date): boolean {
  const readAt = new Date(answer.readAt)
  if (Number.isNaN(readAt.getTime())) return false
  const age = daysBetween(readAt, now)
  // A date in the future is not a fresh answer; it is a typo or a lie, and
  // either way it must not read as verified.
  return age >= 0 && age <= ANSWER_VALID_DAYS
}
