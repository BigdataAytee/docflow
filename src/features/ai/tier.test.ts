/**
 * The §N ladder, at every boundary.
 *
 * The facts come from a device; deciding what they mean does not — which is
 * why this is the one part of §N testable without a phone. The physical-device
 * acceptance gate is a separate, deferred thing.
 */

import { describe, expect, it } from 'vitest'

import {
  MODEL_DOWNLOAD_GB,
  TIER_A_MIN_RAM_GB,
  TIER_B_MIN_RAM_GB,
  canInstallModel,
  capabilitiesOf,
  classify,
} from './tier'

const fast = { soc: 'anything', benchmarkMs: 100 }

describe('The ladder puts each phone on its own rung (§N)', () => {
  it('gives a capable phone Tier A', () => {
    expect(classify({ ramGb: 8, ...fast }).tier).toBe('A')
  })

  it('gives the realistic market phone Tier B', () => {
    // §N: "3–4GB RAM (the realistic market phone)".
    expect(classify({ ramGb: 3, ...fast }).tier).toBe('B')
    expect(classify({ ramGb: 4, ...fast }).tier).toBe('B')
  })

  it('puts a phone below the floor on Tier C', () => {
    expect(classify({ ramGb: 2, ...fast }).tier).toBe('C')
  })

  it('holds the boundaries exactly', () => {
    expect(classify({ ramGb: TIER_A_MIN_RAM_GB, ...fast }).tier).toBe('A')
    expect(classify({ ramGb: TIER_A_MIN_RAM_GB - 0.1, ...fast }).tier).toBe('B')
    expect(classify({ ramGb: TIER_B_MIN_RAM_GB, ...fast }).tier).toBe('B')
    expect(classify({ ramGb: TIER_B_MIN_RAM_GB - 0.1, ...fast }).tier).toBe('C')
  })
})

describe('An unsupported phone is never relabelled "needs internet" (§N)', () => {
  it('gives a reason about the DEVICE, every time', () => {
    const results = [
      classify({ ramGb: 1 }),
      classify({}),
      classify({ ramGb: 8, benchmarkMs: 9999 }),
      classify({ installDeclined: true }),
      classify({ ramGb: 4, ...fast }),
    ]
    for (const result of results) {
      // The temptation is "you are offline", because it sounds fixable. It is
      // a lie, and §N names it specifically.
      expect(result.reason).not.toMatch(/internet|offline|connect|network/i)
      expect(result.reason).toMatch(/phone/i)
    }
  })
})

describe('What is not known is not assumed to be good', () => {
  it('does not claim Tier A for a phone that reported no memory', () => {
    // Claiming Tier A on a phone that cannot load a 1GB model means a
    // download that fails after the bytes are spent.
    expect(classify({}).tier).toBe('C')
  })

  it('does not claim Tier A before the benchmark has run', () => {
    // §N runs it "on first use", so before then nothing is known.
    expect(classify({ ramGb: 8, soc: 'x' }).tier).toBe('B')
  })

  it('honours a decline whatever the hardware says', () => {
    // "install failed/declined" is a Tier C trigger in its own right.
    // Overriding it because the phone is fast is the app deciding for someone.
    expect(classify({ ramGb: 16, ...fast, installDeclined: true }).tier).toBe('C')
  })
})

describe('What each rung can do', () => {
  it('gives Tier B extraction with no download at all', () => {
    const b = capabilitiesOf('B')
    // The whole point of the deterministic extractor: the realistic market
    // phone extracts without a gigabyte of anything.
    expect(b.extraction).toBe('rules')
    expect(b.needsModelDownload).toBe(false)
  })

  it('offers free-form questions only where a model can answer them', () => {
    expect(capabilitiesOf('A').freeFormAsk).toBe(true)
    expect(capabilitiesOf('B').freeFormAsk).toBe(false)
    expect(capabilitiesOf('C').freeFormAsk).toBe(false)
  })

  it('leaves Tier C manual, and says so', () => {
    expect(capabilitiesOf('C').extraction).toBe('manual')
  })
})

describe('The model download needs room to land', () => {
  it('wants headroom, not the bare size', () => {
    // Filling the last byte of a phone breaks everything else on it.
    expect(canInstallModel({ freeStorageGb: MODEL_DOWNLOAD_GB })).toBe(false)
    expect(canInstallModel({ freeStorageGb: MODEL_DOWNLOAD_GB * 2 })).toBe(true)
  })

  it('refuses when storage is unknown', () => {
    expect(canInstallModel({})).toBe(false)
  })
})
