/**
 * When DocFlow may ask to be rated (§T; Apple 3.2.2(x)).
 */

import { describe, expect, it } from 'vitest'

import {
  DAYS_BETWEEN_ASKS,
  MOST_ASKS_EVER,
  type Context,
  type Moment,
  NEVER_ASKED,
  type PromptState,
  SHARES_BEFORE_ASKING,
  afterAsking,
  afterShare,
  decide,
} from './prompt'

const NOW = new Date('2026-09-14T09:00:00.000Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const earned: PromptState = { shares: SHARES_BEFORE_ASKING, asks: 0 }

const ask = (over: Partial<Context> = {}): ReturnType<typeof decide> =>
  decide({
    state: earned,
    moment: 'share_handed_off',
    now: NOW,
    isDemo: false,
    deletionScheduled: false,
    available: true,
    ...over,
  })

describe('The one moment it asks', () => {
  it('asks after a share that worked, and only then', () => {
    expect(ask()).toEqual({ ask: true })

    const unhappy: Moment[] = [
      'share_failed',
      'void_recorded',
      'credit_note_recorded',
      'account_deletion_requested',
    ]
    for (const moment of unhappy) {
      expect(ask({ moment }), moment).toEqual({ ask: false, why: 'not_a_happy_moment' })
    }
  })

  it('does not ask on a merely neutral moment either', () => {
    // Issuing and recording a payment are good things; neither is the moment
    // §T names, and a prompt at every good thing is a prompt at every thing.
    expect(ask({ moment: 'document_issued' })).toEqual({ ask: false, why: 'not_a_happy_moment' })
    expect(ask({ moment: 'payment_recorded' })).toEqual({ ask: false, why: 'not_a_happy_moment' })
  })
})

describe('Every reason not to ask', () => {
  it('says nothing until the app has done something for you', () => {
    expect(ask({ state: NEVER_ASKED })).toEqual({ ask: false, why: 'too_few_shares' })
    expect(ask({ state: { shares: SHARES_BEFORE_ASKING - 1, asks: 0 } })).toEqual({
      ask: false,
      why: 'too_few_shares',
    })
  })

  it('never asks in a demo, however many shares it has seen', () => {
    // §R: a demo is not an account, and a sample is not an achievement.
    expect(ask({ isDemo: true, state: { shares: 99, asks: 0 } })).toEqual({
      ask: false,
      why: 'demo',
    })
  })

  it('never asks somebody on their way out', () => {
    expect(ask({ deletionScheduled: true })).toEqual({ ask: false, why: 'leaving' })
  })

  it('never asks where there is no review API to ask with', () => {
    // §N: an unavailable capability is stated plainly, never dressed up.
    expect(ask({ available: false })).toEqual({ ask: false, why: 'unavailable' })
  })

  it('leaves months between asks', () => {
    const asked = { shares: 99, asks: 1, lastAskedAt: ago(DAYS_BETWEEN_ASKS - 1) }
    expect(ask({ state: asked })).toEqual({ ask: false, why: 'asked_too_recently' })

    const long = { shares: 99, asks: 1, lastAskedAt: ago(DAYS_BETWEEN_ASKS + 1) }
    expect(ask({ state: long })).toEqual({ ask: true })
  })

  it('stops asking for good after a few times', () => {
    const spent = { shares: 99, asks: MOST_ASKS_EVER, lastAskedAt: ago(9999) }
    expect(ask({ state: spent })).toEqual({ ask: false, why: 'asked_enough' })
  })

  it('is not silenced forever by a clock that moved', () => {
    // A stored date in the future would otherwise read as "asked recently"
    // until the real clock caught up with it.
    const ahead = { shares: 99, asks: 1, lastAskedAt: ago(-400) }
    expect(ask({ state: ahead })).toEqual({ ask: true })

    const nonsense = { shares: 99, asks: 1, lastAskedAt: 'soon' }
    expect(ask({ state: nonsense })).toEqual({ ask: false, why: 'asked_too_recently' })
  })

  it('puts the insulting reasons first, so a refusal reads honestly', () => {
    // Leaving AND too few shares: the answer must be "they are leaving".
    expect(ask({ deletionScheduled: true, state: NEVER_ASKED })).toEqual({
      ask: false,
      why: 'leaving',
    })
  })
})

describe('What the counters count', () => {
  it('counts shares that worked, and nothing else', () => {
    expect(afterShare(NEVER_ASKED, 'share_handed_off').shares).toBe(1)
    expect(afterShare(NEVER_ASKED, 'share_failed').shares).toBe(0)
    expect(afterShare(NEVER_ASKED, 'document_issued').shares).toBe(0)
  })

  it('records the ask, and nothing about the rating', () => {
    const after = afterAsking(earned, NOW)
    expect(after.asks).toBe(1)
    expect(after.lastAskedAt).toBe(NOW.toISOString())

    // The system's prompt reports no outcome by design. A field for whether
    // somebody rated could only ever hold a guess.
    expect(Object.keys(after).sort()).toEqual(['asks', 'lastAskedAt', 'shares'])
  })

  it('walks a whole device from first share to spent', () => {
    let state = NEVER_ASKED
    let now = NOW

    for (let i = 0; i < SHARES_BEFORE_ASKING; i += 1) {
      state = afterShare(state, 'share_handed_off')
    }
    expect(ask({ state, now })).toEqual({ ask: true })

    for (let i = 0; i < MOST_ASKS_EVER; i += 1) {
      state = afterAsking(state, now)
      now = new Date(now.getTime() + (DAYS_BETWEEN_ASKS + 1) * 86_400_000)
    }

    expect(ask({ state, now })).toEqual({ ask: false, why: 'asked_enough' })
  })
})
