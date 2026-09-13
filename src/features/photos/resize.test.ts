/**
 * Making a phone photograph small enough to sync (§M).
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { MAX_EDGE, isImage, targetSize } from './resize'

describe('A photo is stored legible, not archival (§M)', () => {
  it('brings a phone photograph down to the long edge', () => {
    // 4032 × 3024 is an ordinary phone camera.
    expect(targetSize({ width: 4032, height: 3024 })).toEqual({ width: 1600, height: 1200 })
  })

  it('works the same way for a portrait photo', () => {
    expect(targetSize({ width: 3024, height: 4032 })).toEqual({ width: 1200, height: 1600 })
  })

  it('never enlarges a small one', () => {
    // A bigger file carrying no more information helps nobody.
    expect(targetSize({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 })
  })

  it('leaves one exactly at the limit alone', () => {
    expect(targetSize({ width: MAX_EDGE, height: 900 })).toEqual({ width: MAX_EDGE, height: 900 })
  })

  it('survives a photo of nothing', () => {
    expect(targetSize({ width: 0, height: 0 })).toEqual({ width: 0, height: 0 })
  })

  it('never rounds a dimension away to nothing', () => {
    // A 4000 × 1 panorama is a strange photo, not a crash.
    expect(targetSize({ width: 4000, height: 1 })).toEqual({ width: 1600, height: 1 })
  })

  it('keeps the long edge within the limit, for any photo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20_000 }),
        fc.integer({ min: 1, max: 20_000 }),
        (width, height) => {
          const size = targetSize({ width, height })
          return Math.max(size.width, size.height) <= MAX_EDGE && size.width >= 1 && size.height >= 1
        },
      ),
    )
  })

  it('keeps the shape of the photo to within rounding, for any photo', () => {
    // Stated as what the function actually promises rather than as a tuned
    // tolerance: each stored dimension is the exact scaled one, rounded to a
    // whole pixel. A ratio tolerance would have needed a constant chosen to
    // fit the worst aspect ratio tried, which says nothing about stretching.
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20_000 }),
        fc.integer({ min: 1, max: 20_000 }),
        (width, height) => {
          const size = targetSize({ width, height })
          const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
          return (
            Math.abs(size.width - width * scale) <= 1 &&
            Math.abs(size.height - height * scale) <= 1
          )
        },
      ),
    )
  })

  it('stretches an ordinary photo by nothing anybody could see', () => {
    // The shapes a phone actually produces, where the short edge is big
    // enough that rounding is invisible.
    for (const [width, height] of [
      [4032, 3024],
      [3024, 4032],
      [4000, 2250],
      [1920, 1080],
    ] as const) {
      const size = targetSize({ width, height })
      const before = width / height
      const after = size.width / size.height
      expect(Math.abs(before - after) / before).toBeLessThan(0.002)
    }
  })
})

describe('Only a photograph is accepted', () => {
  it('takes what a camera produces', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/heic', 'image/webp']) {
      expect(isImage(type)).toBe(true)
    }
  })

  it('refuses what it cannot draw', () => {
    for (const type of ['application/pdf', 'text/html', 'video/mp4', '']) {
      expect(isImage(type)).toBe(false)
    }
  })
})
