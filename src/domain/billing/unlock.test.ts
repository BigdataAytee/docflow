/**
 * What an unlock sheet may say (§U, Rule #1).
 */

import { describe, expect, it } from 'vitest'

import {
  ENTRY_POINTS,
  FORBIDDEN_IN_A_SHEET,
  PRICES,
  type PriceTable,
  featuresWithNoEntryPoint,
  offerFor,
} from './unlock'
import type { FeatureSplit } from './split'

const recorded: FeatureSplit = {
  reviewStatus: 'recorded',
  recordedAt: '2026-09-14',
  proFeatures: ['statements'],
}

const priced: PriceTable = {
  reviewStatus: 'recorded',
  recordedAt: '2026-09-14',
  prices: [
    { market: 'NG', monthlyMinor: 2_500_00, annualMinor: 25_000_00, currency: 'NGN', trialDays: 7 },
  ],
}

const entry = { statements: 'the Statement button on a customer' }

describe('Nothing opens today, because nothing is decided (§W)', () => {
  it('refuses every offer while the split is undecided', () => {
    expect(offerFor('statements', 'NG')).toEqual({ offer: false, why: 'split_undecided' })
    expect(PRICES.reviewStatus).toBe('undecided')
    expect(ENTRY_POINTS).toEqual({})
  })
})

describe('A sheet never opens without a price (§U)', () => {
  it('refuses when the price table is undecided', () => {
    const result = offerFor('statements', 'NG', recorded, PRICES, entry)
    expect(result).toEqual({ offer: false, why: 'no_price' })
  })

  it('ignores prices filled in before the decision was recorded', () => {
    // The same trap as the split: an edit that fills in the numbers and
    // forgets `reviewStatus` must not start charging. The two move together,
    // and the direction they fail in is free. (Found by mutation: the empty
    // table made this guard look redundant.)
    const draft: PriceTable = { reviewStatus: 'undecided', prices: priced.prices }
    expect(offerFor('statements', 'NG', recorded, draft, entry)).toEqual({
      offer: false,
      why: 'no_price',
    })
  })

  it('refuses in a market with no price of its own', () => {
    // §U wants regional pricing "sane, not naive conversions". A market
    // nobody priced is a market where nothing is sold — not one where
    // somebody is asked to guess.
    expect(offerFor('statements', 'GH', recorded, priced, entry)).toEqual({ offer: false, why: 'no_price' })
  })

  it('opens with the price and the trial when both exist', () => {
    const result = offerFor('statements', 'NG', recorded, priced, entry)
    expect(result.offer).toBe(true)
    if (!result.offer) throw new Error('expected an offer')

    expect(result.value.price.monthlyMinor).toBe(2_500_00)
    expect(result.value.price.trialDays).toBe(7)
    expect(result.value.entryPoint).toBe(entry.statements)
  })
})

describe('Nothing is gated without somewhere to announce it (§U)', () => {
  it('refuses an offer for a feature with no entry point', () => {
    // "A gated feature announces itself BEFORE the user invests effort" is
    // only true if somebody can point at the control where it announces.
    const orphan: FeatureSplit = { ...recorded, proFeatures: ['analytics'] }
    expect(offerFor('analytics', 'NG', orphan, priced, entry)).toEqual({
      offer: false,
      why: 'no_entry_point',
    })
  })

  it('names every Pro feature that has nowhere to announce itself', () => {
    expect(featuresWithNoEntryPoint(recorded, {})).toEqual(['statements'])
    expect(featuresWithNoEntryPoint(recorded, entry)).toEqual([])
  })

  it('holds the shipped tables to that rule', () => {
    // Vacuous today and the point of it is tomorrow: the commit that gates a
    // feature without an entry point fails here rather than shipping a
    // paywall that appears after the work.
    expect(featuresWithNoEntryPoint()).toEqual([])
  })
})

describe('Every refusal leaves the feature usable', () => {
  it('never turns a refusal into a lock', () => {
    // The direction this fails in is the whole design: a bug that hides a
    // paywall costs money, and a bug that shows one without a price costs
    // somebody's trust in the app.
    const refusals = [
      offerFor('statements', 'NG'),
      offerFor('statements', 'GH', recorded, priced, entry),
      offerFor('analytics', 'NG', { ...recorded, proFeatures: ['analytics'] }, priced, entry),
      offerFor('customers', 'NG', recorded, priced, entry),
    ]
    for (const result of refusals) expect(result.offer).toBe(false)
  })

  it('says a feature nobody made Pro is simply not gated', () => {
    expect(offerFor('customers', 'NG', recorded, priced, entry)).toEqual({
      offer: false,
      why: 'not_gated',
    })
  })
})

describe('The four things a sheet must not do (§U)', () => {
  it('writes them down, so the tests read as the rule', () => {
    expect(FORBIDDEN_IN_A_SHEET).toHaveLength(4)
    expect(FORBIDDEN_IN_A_SHEET.join(' ')).toContain('countdown')
    expect(FORBIDDEN_IN_A_SHEET.join(' ')).toContain('work already done')
  })
})
