/**
 * The one call a screen makes (§T).
 *
 * Everything the decision needs is a parameter, so the rule is testable
 * without a browser and the screen cannot accidentally decide anything for
 * itself. The counters are read and written here rather than in the screen,
 * because a share that worked must be counted even when the answer is "do not
 * ask" — otherwise the third share never arrives.
 */

import {
  type Context,
  type Decision,
  type Moment,
  afterAsking,
  afterShare,
  decide,
} from '../../domain/ratings/prompt'
import { readPromptState, writePromptState } from './device'
import type { ReviewPort } from './port'

export interface AskInput {
  readonly moment: Moment
  readonly port: ReviewPort
  readonly isDemo: boolean
  readonly deletionScheduled: boolean
  readonly now?: Date
  /** Injected in tests; the device store otherwise. */
  readonly read?: () => Context['state']
  readonly write?: (state: Context['state']) => void
}

export interface AskReport {
  readonly decision: Decision
  /** What the platform did with the request, when one was made. */
  readonly outcome?: 'asked' | 'unavailable' | 'failed'
}

export async function maybeAskForReview(input: AskInput): Promise<AskReport> {
  const read = input.read ?? readPromptState
  const write = input.write ?? writePromptState
  const now = input.now ?? new Date()

  // Counted FIRST, and regardless of the decision: a share that worked is a
  // share that worked, and a counter that only moved when the app asked would
  // never reach the threshold that lets it ask.
  const counted = afterShare(read(), input.moment)
  if (counted.shares !== read().shares) write(counted)

  const decision = decide({
    state: counted,
    moment: input.moment,
    now,
    isDemo: input.isDemo,
    deletionScheduled: input.deletionScheduled,
    available: input.port.capability().review,
  })
  if (!decision.ask) return { decision }

  const outcome = await input.port.request()
  // The ask is recorded only when the platform took it. A request that failed
  // was not an ask, and burning the cooldown on it would cost a real one.
  if (outcome === 'asked') write(afterAsking(counted, now))
  return { decision, outcome }
}
