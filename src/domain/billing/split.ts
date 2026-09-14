/**
 * Which features are Pro (§U, §W).
 *
 * **Nothing, yet — and that is not an oversight.**
 *
 * §U: "The exact free/Pro line is a **product decision recorded in §W** before
 * Phase 5 — the architecture below is indifferent to where the line lands."
 * §W still lists it under decisions requiring evidence: "The exact Free/Pro
 * feature split and price points per market (including whether AI tools are
 * Pro-only or metered), decided before Phase 5 and recorded here."
 *
 * So the split is DATA, it is empty, and `reviewStatus` gates it the same way
 * the terminology tables are gated by native-speaker sign-off. Inventing the
 * line would be inventing product — and it would be the expensive kind of
 * invention, because a feature that becomes Pro after people have used it for
 * free is a feature you cannot take back without a fight.
 *
 * The mechanism is built and tested regardless, exactly as §U asks. The day
 * somebody records the split in §W, this file changes and nothing else does.
 *
 * Until then every `allowed()` check answers yes, which is also what §U says
 * should happen: "everything defaults to Free features until billing exists".
 */

export type ReviewStatus = 'undecided' | 'recorded'

export interface FeatureSplit {
  /**
   * `undecided` until §W records the line. Nothing may be gated while it
   * reads that — a guard rather than a comment, so a half-finished edit
   * cannot start charging for something.
   */
  readonly reviewStatus: ReviewStatus
  /** Recorded in §W, by a person, with a date. */
  readonly recordedAt?: string
  readonly proFeatures: readonly string[]
}

export const SPLIT: FeatureSplit = {
  reviewStatus: 'undecided',
  proFeatures: [],
}

/**
 * The Pro list to hold a feature against.
 *
 * Empty whenever the split is undecided, whatever the table says — so an
 * edit that fills in `proFeatures` and forgets `reviewStatus` gates nothing.
 * The two have to move together, and the direction they fail in is free.
 */
export const proFeatures = (split: FeatureSplit = SPLIT): readonly string[] =>
  split.reviewStatus === 'recorded' ? split.proFeatures : []
