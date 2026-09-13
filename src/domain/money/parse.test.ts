import { describe, expect, it } from 'vitest'

import { parseAmount } from './parse'

const NGN = { scale: 100 } as const

describe('Text a person typed becomes exact minor units (Rule #3)', () => {
  it('reads the ways people actually write money', () => {
    expect(parseAmount('5000', NGN)).toBe(500_000)
    expect(parseAmount('5,000', NGN)).toBe(500_000)
    expect(parseAmount('5,000.50', NGN)).toBe(500_050)
    expect(parseAmount('₦5,000', NGN)).toBe(500_000)
    expect(parseAmount('  5 000,  ', { scale: 100 })).toBe(500_000)
    expect(parseAmount('NGN 5000', NGN)).toBe(500_000)
    expect(parseAmount('0', NGN)).toBe(0)
  })

  it('follows the locale decimal mark, in both directions (§S)', () => {
    // "1.234,56" is one thousand two hundred, not one point two three four.
    // Backwards, this is a hundredfold error that looks entirely ordinary.
    expect(parseAmount('1.234,56', { scale: 100, decimal: ',' })).toBe(123_456)
    expect(parseAmount('1,234.56', { scale: 100, decimal: '.' })).toBe(123_456)
  })

  it('leaves a zero-decimal currency alone', () => {
    expect(parseAmount('1500', { scale: 1 })).toBe(1500)
    expect(parseAmount('1.5', { scale: 1 })).toBeNull()
  })

  it('returns null for a blank, never zero', () => {
    // The whole reason this exists. `Number('')` is 0, so a blank amount
    // would save as no money owed, with nothing to say why.
    for (const blank of ['', '   ', ' ', '₦']) {
      expect(parseAmount(blank, NGN), JSON.stringify(blank)).toBeNull()
    }
  })

  it('refuses what Number() would silently coerce', () => {
    expect(Number('0x10')).toBe(16)
    expect(parseAmount('0x10', NGN)).toBeNull()
    expect(Number('5e2')).toBe(500)
    expect(parseAmount('5e2', NGN)).toBeNull()
    expect(parseAmount('abc', NGN)).toBeNull()
    expect(parseAmount('1.2.3', NGN)).toBeNull()
  })

  it('refuses more precision than the currency has', () => {
    // `Math.round(1.005 * 100)` is 100, not 101 — the one place the float
    // genuinely does not recover. Refusing beats recording a kobo less.
    expect(Math.round(1.005 * 100)).toBe(100)
    expect(parseAmount('1.005', NGN)).toBeNull()
  })

  it('refuses an amount too large to count exactly', () => {
    expect(parseAmount('99999999999999999999', NGN)).toBeNull()
  })
})
