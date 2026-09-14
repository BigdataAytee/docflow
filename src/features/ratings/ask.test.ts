/**
 * The one call a screen makes (§T, §R, §N).
 */

import { describe, expect, it, vi } from 'vitest'

import { maybeAskForReview } from './ask'
import type { ReviewPort } from './port'
import {
  DAYS_BETWEEN_ASKS,
  NEVER_ASKED,
  type PromptState,
  SHARES_BEFORE_ASKING,
} from '../../domain/ratings/prompt'

const NOW = new Date('2026-09-14T09:00:00.000Z')

function harness(
  start: PromptState = NEVER_ASKED,
  capability = { review: true },
  outcome: 'asked' | 'unavailable' | 'failed' = 'asked',
) {
  let state = start
  const request = vi.fn(async () => outcome)
  const port: ReviewPort = { capability: () => capability, request }
  return {
    request,
    get state() {
      return state
    },
    run: (moment: Parameters<typeof maybeAskForReview>[0]['moment'], over = {}) =>
      maybeAskForReview({
        moment,
        port,
        isDemo: false,
        deletionScheduled: false,
        now: NOW,
        read: () => state,
        write: (next) => {
          state = next
        },
        ...over,
      }),
  }
}

const earned: PromptState = { shares: SHARES_BEFORE_ASKING, asks: 0 }

describe('Asking, or not', () => {
  it('counts a share that worked even when it does not ask', async () => {
    // The counter must move on every good share, or the third one never
    // arrives and the prompt can never fire at all.
    const h = harness()
    const report = await h.run('share_handed_off')

    expect(report.decision).toEqual({ ask: false, why: 'too_few_shares' })
    expect(h.state.shares).toBe(1)
    expect(h.request).not.toHaveBeenCalled()
  })

  it('does not count a share that failed', async () => {
    const h = harness()
    await h.run('share_failed')
    expect(h.state.shares).toBe(0)
  })

  it('asks once the app has earned it, and records the ask', async () => {
    const h = harness(earned)
    const report = await h.run('share_handed_off')

    expect(report).toEqual({ decision: { ask: true }, outcome: 'asked' })
    expect(h.request).toHaveBeenCalledTimes(1)
    expect(h.state.asks).toBe(1)
    expect(h.state.lastAskedAt).toBe(NOW.toISOString())
  })

  it('does not burn the cooldown on a request the platform refused', async () => {
    // A failed request was not an ask. Recording it would cost a real one,
    // months from now, for nothing.
    const h = harness(earned, { review: true }, 'failed')
    const report = await h.run('share_handed_off')

    expect(report.outcome).toBe('failed')
    expect(h.state.asks).toBe(0)
    expect(h.state.lastAskedAt).toBeUndefined()
  })

  it('never reaches the platform in a demo', async () => {
    const h = harness(earned)
    const report = await h.run('share_handed_off', { isDemo: true })

    expect(report.decision).toEqual({ ask: false, why: 'demo' })
    expect(h.request).not.toHaveBeenCalled()
  })

  it('never reaches the platform while the account is leaving', async () => {
    const h = harness(earned)
    const report = await h.run('share_handed_off', { deletionScheduled: true })

    expect(report.decision).toEqual({ ask: false, why: 'leaving' })
    expect(h.request).not.toHaveBeenCalled()
  })

  it('says plainly when the platform has no review API', async () => {
    // §N: an unavailable capability is stated, never dressed up. The web has
    // none, which is why this is the honest answer today.
    const h = harness(earned, { review: false })
    const report = await h.run('share_handed_off')

    expect(report.decision).toEqual({ ask: false, why: 'unavailable' })
    expect(h.request).not.toHaveBeenCalled()
    // And the share is still counted, so a later native build starts with a
    // device that has already earned the ask.
    expect(h.state.shares).toBe(SHARES_BEFORE_ASKING + 1)
  })

  it('stays quiet for months after asking', async () => {
    const h = harness(earned)
    await h.run('share_handed_off')

    const again = await h.run('share_handed_off')
    expect(again.decision).toEqual({ ask: false, why: 'asked_too_recently' })
    expect(h.request).toHaveBeenCalledTimes(1)

    const later = await h.run('share_handed_off', {
      now: new Date(NOW.getTime() + (DAYS_BETWEEN_ASKS + 1) * 86_400_000),
    })
    expect(later.decision).toEqual({ ask: true })
  })
})
