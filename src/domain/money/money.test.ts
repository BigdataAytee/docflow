/**
 * Money property tests — v6 §Q Phase 0: "in CI on day one … these run on every
 * commit for the life of the project." Blocking before merge (CLAUDE.md).
 *
 * Group 4 of the five: currency buckets never mix.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  CurrencyMismatchError,
  MoneyError,
  PPM,
  add,
  applyRate,
  compare,
  money,
  mulDivRoundHalfUp,
  percentToPpm,
  subtract,
  sum,
  zero,
} from './money'
import { distribute } from './distribute'

const CURRENCIES = ['NGN', 'GHS', 'GBP', 'USD', 'EUR', 'INR', 'AED'] as const

const arbCurrency = fc.constantFrom(...CURRENCIES)
const arbMinor = fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 })
const arbMoney = (currency?: string) =>
  (currency === undefined ? arbCurrency : fc.constant(currency)).chain((c) =>
    arbMinor.map((m) => money(c, m)),
  )

describe('Money is always an integer of minor units', () => {
  it('rejects fractional amounts — no binary float ever holds money (§K)', () => {
    fc.assert(
      fc.property(arbCurrency, fc.double({ noNaN: true, min: -1e9, max: 1e9 }), (c, v) => {
        if (Number.isInteger(v)) return
        expect(() => money(c, v)).toThrow(MoneyError)
      }),
    )
  })

  it('rejects a non-ISO currency code', () => {
    for (const bad of ['ngn', 'NG', 'NGNN', '', '123']) {
      expect(() => money(bad, 100)).toThrow(MoneyError)
    }
  })
})

describe('Currency buckets never mix (§G, §V)', () => {
  it('refuses to add two different currencies', () => {
    fc.assert(
      fc.property(arbMoney(), arbMoney(), (a, b) => {
        if (a.currency === b.currency) return
        expect(() => add(a, b)).toThrow(CurrencyMismatchError)
        expect(() => subtract(a, b)).toThrow(CurrencyMismatchError)
        expect(() => compare(a, b)).toThrow(CurrencyMismatchError)
      }),
    )
  })

  it('keeps the currency through every operation', () => {
    fc.assert(
      fc.property(arbCurrency, arbMinor, arbMinor, (c, x, y) => {
        expect(add(money(c, x), money(c, y)).currency).toBe(c)
        expect(applyRate(money(c, x), 75_000).currency).toBe(c)
      }),
    )
  })

  it('sums an empty list only when told which currency', () => {
    expect(() => sum([])).toThrow(MoneyError)
    expect(sum([], 'NGN')).toEqual(zero('NGN'))
  })
})

describe('Arithmetic is exact and total', () => {
  it('add is associative and commutative within a currency', () => {
    fc.assert(
      fc.property(arbCurrency, arbMinor, arbMinor, arbMinor, (c, x, y, z) => {
        const [a, b, d] = [money(c, x), money(c, y), money(c, z)]
        expect(add(add(a, b), d)).toEqual(add(a, add(b, d)))
        expect(add(a, b)).toEqual(add(b, a))
      }),
    )
  })

  it('subtract undoes add', () => {
    fc.assert(
      fc.property(arbCurrency, arbMinor, arbMinor, (c, x, y) => {
        const a = money(c, x)
        expect(subtract(add(a, money(c, y)), money(c, y))).toEqual(a)
      }),
    )
  })

  it('rounds half away from zero, from the exact product', () => {
    // 0.5 up, -0.5 down (away from zero), never banker's rounding.
    expect(mulDivRoundHalfUp(5, 1, 10)).toBe(1) // 0.5 -> 1
    expect(mulDivRoundHalfUp(-5, 1, 10)).toBe(-1) // -0.5 -> -1
    expect(mulDivRoundHalfUp(15, 1, 10)).toBe(2) // 1.5 -> 2
    expect(mulDivRoundHalfUp(25, 1, 10)).toBe(3) // 2.5 -> 3 (not 2)
    expect(mulDivRoundHalfUp(4, 1, 10)).toBe(0)
  })

  it('is exact where float arithmetic is not', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; in kobo it always is.
    expect(add(money('NGN', 10), money('NGN', 20))).toEqual(money('NGN', 30))
    // 7.5% of ₦1,000.00 is exactly ₦75.00 — no representation drift.
    expect(applyRate(money('NGN', 100_000), percentToPpm(7.5))).toEqual(money('NGN', 7_500))
  })

  it('converts a percentage exactly or refuses', () => {
    expect(percentToPpm(7.5)).toBe(75_000)
    expect(percentToPpm(100)).toBe(PPM)
    expect(percentToPpm(0)).toBe(0)
    expect(() => percentToPpm(1 / 3)).toThrow(MoneyError)
  })
})

describe('Distribution loses and invents nothing', () => {
  it('the parts always sum exactly to the whole', () => {
    fc.assert(
      fc.property(
        arbCurrency,
        arbMinor,
        fc.array(fc.nat({ max: 100_000 }), { minLength: 1, maxLength: 24 }),
        (c, total, weights) => {
          const parts = distribute(money(c, total), weights)
          expect(parts).toHaveLength(weights.length)
          expect(sum(parts, c).minor).toBe(total)
        },
      ),
    )
  })

  it('is deterministic — two devices compute the same split', () => {
    fc.assert(
      fc.property(
        arbMinor,
        fc.array(fc.nat({ max: 10_000 }), { minLength: 1, maxLength: 12 }),
        (total, weights) => {
          expect(distribute(money('NGN', total), weights)).toEqual(
            distribute(money('NGN', total), weights),
          )
        },
      ),
    )
  })

  it('spreads evenly when there is no weight to go on', () => {
    expect(distribute(money('NGN', 10), [0, 0, 0]).map((m) => m.minor)).toEqual([4, 3, 3])
  })
})
