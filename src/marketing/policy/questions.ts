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
  /**
   * What must EXIST before this can be answered at all.
   *
   * Reading a rule and meeting it are different things, and three of these
   * questions turned out to be unanswerable for a reason no amount of
   * reading fixes: there is no plan configured in either console, and the
   * forms they ask about are behind a developer account. A blocked question
   * never counts as satisfied, however recently its rule was read.
   */
  readonly blockedBy?: string
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
    blockedBy:
      'a plan configured in App Store Connect (D10). 3.1.2(a) has been read — a subscription ' +
      'must run at least seven days and work across a person’s devices — but there is no ' +
      'trial length and no per-storefront price to hold against it.',
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
    blockedBy:
      'the questionnaire itself, which is behind the developer account. The public category ' +
      'list and the "processed only on device is not collected" rule have been read and are ' +
      'recorded below; the wording of the questions has not.',
  },
  {
    id: 'apple-account-deletion',
    store: 'apple',
    whatWeDo:
      'An owner can export everything (§S, Rule #6: export is free forever and documents are ' +
      'never held hostage). **There is no account deletion.** This entry claimed there was, ' +
      'and reading Apple 5.1.1(v) is what found the claim untrue — `checks.ts` now fails on it.',
    question:
      'Does the in-app deletion flow meet the current requirement — its placement, what it ' +
      'must delete, and what it may keep?',
    lookIn: 'App Review Guidelines on account deletion',
    perMarket: false,
    blockedBy:
      'an account-deletion flow, which is not built. The rule has been read; the app does ' +
      'not meet it, and no iOS submission can proceed until it does.',
  },
  {
    id: 'apple-ratings-prompt',
    store: 'apple',
    whatWeDo:
      '**Nothing.** §T wants a prompt at a happy moment — after a successful share, never ' +
      'after an error, never gated behind anything — and none is built. This entry described ' +
      'the intended behaviour as though it shipped.',
    question: 'Is that timing and frequency within the current rules for the review API?',
    lookIn:
      'App Review Guidelines 3.2.2(x) covers the coercion half and is readable. The frequency ' +
      'limit of the review API is in the StoreKit documentation, which renders through ' +
      'JavaScript and could not be read from a fetch — open it in a browser.',
    perMarket: false,
    blockedBy: 'a ratings prompt, which is not built. There is no timing to judge.',
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
    lookIn:
      'Play Console policy centre, the Payments policy. NOTE: support.google.com and ' +
      'play.google.com are both blocked from this environment, so no Play policy page could ' +
      'be read here at all — this one needs a browser as well as a console.',
    perMarket: true,
    blockedBy: 'a plan configured in Play Console (D10), and a reachable policy page.',
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
    blockedBy:
      'the form itself, behind the developer account — and support.google.com is blocked ' +
      'from this environment, so not even the public guidance could be read.',
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
    id: 'apple-finance-category',
    store: 'apple',
    whatWeDo:
      'DocFlow records invoices, payments and receipts. It moves no money, holds no funds, ' +
      'and connects to no bank: a payment is a ledger record somebody typed (Rule #3).',
    question:
      'Does that put the app in a finance category with extra requirements in this market — ' +
      'and does the listing describe it in a way that avoids implying otherwise?',
    lookIn: 'App Review Guidelines 3.2.1(viii) and 5.1.1(ix)',
    perMarket: true,
  },
  {
    id: 'play-finance-category',
    store: 'play',
    whatWeDo: 'The same: records kept, no money moved, no bank connected (Rule #3).',
    question:
      'Does Play’s financial-services policy reach an app that only RECORDS payments in this ' +
      'market, and does it require anything of the listing?',
    lookIn:
      'Play’s financial-services policy. NOTE: support.google.com is blocked from this ' +
      'environment, so this could not be read here — it needs a browser.',
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
  /**
   * The person who has checked this answer against its source.
   *
   * `readBy` says who fetched the page. This says who STOOD BEHIND it. An
   * answer read by a machine is a draft with a citation — useful, and not
   * the thing §U asks for, so `verified` requires this and the report says
   * out loud how many answers are waiting for it.
   */
  readonly confirmedBy?: string
}

/**
 * Answers recorded so far.
 *
 * Every one of these was read from the page named in its `source`, fetched on
 * `readAt`, and none was written from memory — which is the thing §U names
 * and the reason this array sat empty until somebody actually opened the
 * rules. What is recorded is what the PUBLIC rule says. Three sorts of
 * question are still missing from it, each for a reason worth keeping:
 *
 *  · the forms themselves — App Store Connect's privacy questionnaire, Play's
 *    Data Safety form — are behind a developer account;
 *  · every Play policy page (support.google.com, play.google.com) is blocked
 *    by this environment's egress proxy, so the Play half was read only where
 *    developer.android.com carries it;
 *  · the EU storefronts have their own external-purchase regime, and the
 *    entitlement page 404s, so FR and ES are deliberately left unanswered
 *    rather than answered from the global paragraph.
 *
 * And `confirmedBy` is empty on all of them. `readBy` says who fetched the
 * page; `confirmedBy` says who stood behind it, and until a person does, the
 * report counts these as drafts with citations.
 */

const APPLE_GUIDELINES = 'https://developer.apple.com/app-store/review/guidelines/'
const READ_AT = '2026-09-14'
const READ_BY = 'claude-code'

/**
 * 3.1.1(a), quoted: the entitlement "is not required for developers to
 * include buttons, external links, or other calls to action in their United
 * States storefront apps", and "in all other storefronts, except for the
 * United States storefront ... apps and their metadata may not include
 * buttons, external links, or other calls to action that direct customers to
 * purchasing mechanisms other than in-app purchase."
 */
const steering = (market: string, answer: string): Answer => ({
  questionId: 'apple-steering',
  market,
  answer,
  source: `${APPLE_GUIDELINES} (3.1.1(a))`,
  readAt: READ_AT,
  readBy: READ_BY,
})

const finance = (market: string): Answer => ({
  questionId: 'apple-finance-category',
  market,
  answer:
    'No extra Apple requirement lands on DocFlow as built. 3.2.1(viii) binds apps "used for ' +
    'financial trading, investing, or money management", which must come from the financial ' +
    'institution performing the service — DocFlow performs none: it records a payment ' +
    'somebody typed and moves nothing (Rule #3). 5.1.1(ix) asks that apps providing services ' +
    'in regulated fields be submitted by a legal entity rather than an individual, which is ' +
    'met by submitting as an organisation and should be done regardless. The listing must ' +
    'not imply DocFlow moves money, holds funds or connects to a bank. NOTE: both are global ' +
    'guideline texts, not per-storefront rules; whether local financial-services LICENSING ' +
    'reaches a record-keeping app in this market is a question for a lawyer, not for Apple.',
  source: `${APPLE_GUIDELINES} (3.2.1(viii), 5.1.1(ix))`,
  readAt: READ_AT,
  readBy: READ_BY,
})

export const ANSWERS: readonly Answer[] = [
  // The steering rule, storefront by storefront. US differs from the rest,
  // which is exactly what §U said would happen.
  steering(
    'US',
    'A link is allowed, and so are buttons and other calls to action: 3.1.1(a) says the ' +
      'entitlement "is not required ... in their United States storefront apps". DocFlow ' +
      'currently says nothing about the web rail, so this is permission it is not using.',
  ),
  ...['NG', 'GH', 'GB', 'AE'].map((market) =>
    steering(
      market,
      'Nothing. 3.1.1(a) prohibits buttons, external links and other calls to action towards ' +
        'any purchasing mechanism other than in-app purchase "in all other storefronts, except ' +
        'for the United States storefront". DocFlow already says nothing, so no change is ' +
        'needed — but the web rail must stay unmentioned in the app AND in its metadata.',
    ),
  ),
  // FR and ES are NOT here on purpose: the EU has its own external-purchase
  // entitlements under the DMA, and the entitlement page 404s from here.

  ...['NG', 'GH', 'GB', 'US', 'FR', 'ES', 'AE'].map(finance),

  {
    questionId: 'play-target-api',
    answer:
      'Android 16, API level 36, for new apps and for updates, since 31 August 2026 — a ' +
      'deadline that has already passed. Existing apps must target at least API 35 to stay ' +
      'available to new users on newer devices; below that they are served only to devices ' +
      'running the app’s own target level or lower. An extension to 1 November 2026 can be ' +
      'requested in Play Console. Separately, Play Billing Library 8 or later is required for ' +
      'new apps and updates from the same date. The Capacitor shell (Phase 4) has no target ' +
      'level set yet, so this is a Phase-4 input rather than a finding against it.',
    source:
      'https://developer.android.com/google/play/requirements/target-sdk and ' +
      'https://developer.android.com/google/play/billing',
    readAt: READ_AT,
    readBy: READ_BY,
  },
  {
    questionId: 'apple-account-deletion',
    answer:
      'The rule, read: the option must be "easy to find ... typically ... included in the ' +
      'app’s account settings"; it must "delete the entire account record, along with ' +
      'associated personal data", and "only offering to temporarily deactivate or disable an ' +
      'account is insufficient"; it covers user-generated content, not just the login; a ' +
      'developer may keep what law requires but must tell the user; a manual or slow process ' +
      'is acceptable if the user is told how long it takes and gets a confirmation; and an ' +
      'app may require an auto-renewable subscription to be cancelled first. DocFlow HAS NO ' +
      'SUCH FLOW — see the failing account-deletion check — so this answer records a rule the ' +
      'app does not yet meet.',
    source: 'https://developer.apple.com/support/offering-account-deletion-in-your-app/',
    readAt: READ_AT,
    readBy: READ_BY,
  },
  {
    questionId: 'apple-privacy-label',
    answer:
      'The half that is public, read: data "processed only on device is not ‘collected’ and ' +
      'does not need to be disclosed", which is the clause §N’s on-device voice, scan and ' +
      'extraction rely on, and data sent to a server but "immediately discarded after ' +
      'servicing the request" likewise. A developer must identify everything they OR their ' +
      'third-party partners collect — DocFlow has no third-party SDK, which `checks.ts` ' +
      'verifies — and must say whether each type is linked to identity. On DocFlow’s ' +
      'destinations the categories that apply are Contact Info, User Content, Identifiers and ' +
      'Financial Info (invoice amounts), all linked to the account, all for App Functionality ' +
      'only; nothing for Analytics, Advertising or Tracking. The QUESTIONNAIRE’s current ' +
      'wording is behind the developer account and has not been read.',
    source: 'https://developer.apple.com/app-store/app-privacy-details/',
    readAt: READ_AT,
    readBy: READ_BY,
  },
  {
    questionId: 'apple-ratings-prompt',
    answer:
      'The coercion half, read: 3.2.2(x) — "Apps must not force users to rate the app, review ' +
      'the app, download other apps, or other store-related actions in order to access ' +
      'functionality, content, or use of the app." DocFlow has no prompt at all, so it cannot ' +
      'breach that. The review API’s own frequency limit is in Apple’s StoreKit ' +
      'documentation, which renders through JavaScript and returned no text to a fetch, so it ' +
      'has NOT been read.',
    source: `${APPLE_GUIDELINES} (3.2.2(x))`,
    readAt: READ_AT,
    readBy: READ_BY,
  },
  {
    questionId: 'apple-subscriptions',
    market: 'US',
    answer:
      'The rule, read, though there is nothing yet to hold against it: 3.1.2(a) — "you must ' +
      'provide ongoing value to the customer, and the subscription period must last at least ' +
      'seven days and be available across all of the user’s devices". Free trials are ' +
      'configured in App Store Connect rather than built into the app. A free tier alongside ' +
      'a subscription is unremarkable under 3.1.1; what would not be is unlocking Pro by any ' +
      'mechanism other than in-app purchase, which Rule #6 does not require — a lapsed plan ' +
      'never locks existing documents, it only stops new ones.',
    source: `${APPLE_GUIDELINES} (3.1.1, 3.1.2, 3.1.2(a))`,
    readAt: READ_AT,
    readBy: READ_BY,
  },
]

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
