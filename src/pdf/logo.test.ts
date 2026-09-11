/**
 * §G / §V — "Logos never crop."
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { LOGO_SCALE, LogoError, fitLogo, isFullyVisible } from './logo'

const HOLDER = { width: 120, height: 120 }
const MARGIN = 8

describe('A logo is never cropped, at any aspect ratio (§V)', () => {
  it('keeps the whole mark inside the holder for every shape and size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8000 }),
        fc.integer({ min: 1, max: 8000 }),
        fc.integer({ min: 20, max: 400 }),
        fc.integer({ min: 0, max: 9 }),
        (w, h, holderSize, margin) => {
          const holder = { width: holderSize, height: holderSize }
          const fit = fitLogo({ width: w, height: h }, holder, margin)
          expect(isFullyVisible(fit, holder, margin)).toBe(true)
        },
      ),
    )
  })

  it('preserves the aspect ratio exactly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 5000 }),
        (w, h) => {
          const fit = fitLogo({ width: w, height: h }, HOLDER, MARGIN)
          expect(fit.width / fit.height).toBeCloseTo(w / h, 8)
        },
      ),
    )
  })
})

describe('§G: square nearly fills, wide spans width, tall runs height', () => {
  it('nearly fills the holder when square', () => {
    const fit = fitLogo({ width: 512, height: 512 }, HOLDER, MARGIN)
    expect(fit.width).toBe(104)
    expect(fit.height).toBe(104)
  })

  it('spans the width when wide, leaving space above and below', () => {
    const fit = fitLogo({ width: 1000, height: 250 }, HOLDER, MARGIN)
    expect(fit.width).toBe(104)
    expect(fit.height).toBe(26)
    expect(fit.top).toBeGreaterThan(MARGIN)
  })

  it('runs the height when tall, leaving space either side', () => {
    const fit = fitLogo({ width: 250, height: 1000 }, HOLDER, MARGIN)
    expect(fit.height).toBe(104)
    expect(fit.width).toBe(26)
    expect(fit.left).toBeGreaterThan(MARGIN)
  })

  it('centres the mark inside the inner box', () => {
    const fit = fitLogo({ width: 1000, height: 250 }, HOLDER, MARGIN)
    expect(fit.left).toBe(MARGIN)
    expect(fit.top + fit.height / 2).toBeCloseTo(HOLDER.height / 2, 8)
  })
})

describe('Refusals rather than guesses', () => {
  it('refuses a logo with no dimensions', () => {
    expect(() => fitLogo({ width: 0, height: 100 }, HOLDER, MARGIN)).toThrow(LogoError)
  })

  it('refuses a margin that leaves no room', () => {
    expect(() => fitLogo({ width: 10, height: 10 }, HOLDER, 60)).toThrow(LogoError)
  })
})

describe('The three sizes (§G)', () => {
  it('orders S, M and L', () => {
    expect(LOGO_SCALE.S).toBeLessThan(LOGO_SCALE.M)
    expect(LOGO_SCALE.M).toBeLessThan(LOGO_SCALE.L)
    expect(LOGO_SCALE.L).toBe(1)
  })
})
