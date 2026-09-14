/**
 * The review port (§T, §N).
 *
 * Shaped like the share port, for the same reason: the platform underneath
 * changes and the screens above must not. Phase 4 swaps in StoreKit's
 * `requestReview` on iOS and Play's In-App Review on Android; today there is
 * no web equivalent at all, and this file says so rather than inventing one.
 *
 * **There is deliberately no outcome.** Both platforms' APIs report nothing
 * about what the person did — whether a prompt appeared, whether a star was
 * given, whether the sheet was dismissed — and that is by design, so that an
 * app cannot treat rating as a transaction. `request()` returns whether the
 * ASK was made, which is all this device can honestly know. It is the same
 * rule the share port follows: a field that cannot be true cannot be believed.
 *
 * Nor is there a "show our own dialog first" pre-prompt. The pattern is
 * common and it exists to filter unhappy people out of the store listing,
 * which is a thing to do to a rating rather than for a person.
 */

export interface ReviewCapability {
  /** A platform review API is reachable on this device, right now. */
  readonly review: boolean
}

export const NO_REVIEW: ReviewCapability = { review: false }

export type AskOutcome = 'asked' | 'unavailable' | 'failed'

export interface ReviewPort {
  capability(): ReviewCapability
  /** Hands the request to the platform. Says whether it was handed over. */
  request(): Promise<AskOutcome>
}

/**
 * The web, today.
 *
 * Neither Safari nor Chrome has a review API, and the App Store page for an
 * app that is not installed is not a rating prompt — it is an advertisement
 * in the middle of somebody's invoice. So this asks nothing and reports
 * `unavailable`, which the decision in `src/domain/ratings` reads as a
 * refusal before anything is attempted.
 */
export const unavailableReviewPort: ReviewPort = {
  capability: () => NO_REVIEW,
  request: async () => 'unavailable',
}

export const createWebReviewPort = (): ReviewPort => unavailableReviewPort
