/**
 * What an unlock sheet may say (§U, Rule #1).
 *
 * §U: "contextual unlock sheets exactly where a gated feature is tapped
 * ('Statements are part of Pro'), each with **the price, the trial, and a
 * no-hard-feelings dismiss**. No modal ambushes, no fake urgency, no feature
 * that silently produces a paywall after work is done — a gated feature
 * announces itself **before** the user invests effort."
 *
 * Three rules come out of that paragraph, and all three are here rather than
 * in the component, because a rule in a component is a rule one refactor from
 * gone.
 *
 * **A sheet without a price does not open.** "Tap to find out what it costs"
 * is the dark pattern §U is describing, told backwards. If the price for this
 * market is not known, the offer is REFUSED and the feature stays ungated —
 * the mechanism fails open, towards the person, rather than towards the
 * money.
 *
 * **Nothing is gated without an announcement point.** A Pro feature has to
 * name the control a person meets BEFORE they start working, so the badge
 * that says "Pro" can sit on it. A feature with no entry point cannot be
 * gated at all, which is what stops a paywall appearing after the work.
 *
 * **Prices are §W's, not ours.** §U asks for "regional pricing per store
 * templates so NGN, GHS, INR prices are sane, not naive conversions", and §W
 * still lists "price points per market" under decisions requiring evidence.
 * So the table is empty and gated by the same `reviewStatus` as the split,
 * and inventing a number here would be inventing a price.
 */

import { type FeatureSplit, SPLIT, proFeatures } from './split'

export interface Price {
  /** The store's own market code, e.g. 'NG'. */
  readonly market: string
  /** Minor units (Rule #3 — never a float, anywhere, including a price). */
  readonly monthlyMinor: number
  readonly annualMinor: number
  readonly currency: string
  /** Days, as configured in the store's offer. */
  readonly trialDays: number
}

export interface PriceTable {
  readonly reviewStatus: 'undecided' | 'recorded'
  readonly recordedAt?: string
  readonly prices: readonly Price[]
}

/**
 * Empty, and honestly so.
 *
 * The day §W records the price points, this file changes and nothing else
 * does — the sheet, the badge and the gate are all written against it.
 */
export const PRICES: PriceTable = { reviewStatus: 'undecided', prices: [] }

/**
 * Where a person meets a gated feature BEFORE doing any work.
 *
 * A map rather than a convention, because §U's "announces itself before the
 * user invests effort" is only true if somebody can point at the control
 * where it announces. `entryPointsCover` is what makes that checkable.
 */
export const ENTRY_POINTS: Readonly<Record<string, string>> = {}

export type OfferRefusal = 'not_gated' | 'split_undecided' | 'no_price' | 'no_entry_point'

export interface Offer {
  readonly feature: string
  readonly price: Price
  /** The control this feature is reached from, for the badge. */
  readonly entryPoint: string
}

export type OfferResult =
  | { readonly offer: true; readonly value: Offer }
  | { readonly offer: false; readonly why: OfferRefusal }

/**
 * May a sheet open for this feature, in this market, and what does it say?
 *
 * Every refusal leaves the feature USABLE. That is the direction this has to
 * fail in: a bug that hides a paywall costs money, and a bug that shows one
 * without a price costs somebody's trust in the app.
 */
export function offerFor(
  feature: string,
  market: string,
  split: FeatureSplit = SPLIT,
  prices: PriceTable = PRICES,
  entryPoints: Readonly<Record<string, string>> = ENTRY_POINTS,
): OfferResult {
  if (split.reviewStatus !== 'recorded') return { offer: false, why: 'split_undecided' }
  if (!proFeatures(split).includes(feature)) return { offer: false, why: 'not_gated' }

  // Before the price, deliberately: a Pro feature with nowhere to announce
  // itself is a code defect, and the refusal should say so rather than
  // blaming a missing price.
  const entryPoint = entryPoints[feature]
  if (entryPoint === undefined) return { offer: false, why: 'no_entry_point' }

  if (prices.reviewStatus !== 'recorded') return { offer: false, why: 'no_price' }
  const price = prices.prices.find((row) => row.market === market)
  // A market with no price is a market where nothing is sold, not a market
  // where somebody is asked to guess.
  if (price === undefined) return { offer: false, why: 'no_price' }

  return { offer: true, value: { feature, price, entryPoint } }
}

/**
 * Does every Pro feature have somewhere to announce itself?
 *
 * Returns the ones that do not. Empty is the only acceptable answer, and a
 * test holds it — so the commit that gates a feature without an entry point
 * fails, rather than shipping a paywall that appears after the work.
 */
export function featuresWithNoEntryPoint(
  split: FeatureSplit = SPLIT,
  entryPoints: Readonly<Record<string, string>> = ENTRY_POINTS,
): readonly string[] {
  return proFeatures(split).filter((feature) => entryPoints[feature] === undefined)
}

/**
 * Everything a sheet must NOT do, as data.
 *
 * §U names four dark patterns. They are listed so the tests read as the
 * rule rather than as somebody's taste, and so the list can grow when
 * somebody spots a fifth.
 */
export const FORBIDDEN_IN_A_SHEET = [
  'a countdown, or any other manufactured deadline',
  'a dismiss that is harder to find than the purchase',
  'opening over work already done',
  'opening without the price and the trial on it',
] as const
