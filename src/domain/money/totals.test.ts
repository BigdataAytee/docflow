/**
 * Totals property tests — v6 §Q Phase 0 group 5:
 * "discount/tax/WHT ordering matches worked examples".
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { MoneyError, add, money, percentToPpm, subtract, sum } from './money'
import { computeTotals } from './totals'
import { type LineItem, quantity } from '../documents/types'

const line = (
  id: string,
  qtyUnits: number,
  unitPriceMinor: number,
  taxable = true,
): LineItem => ({
  id,
  description: id,
  quantityMilli: quantity(qtyUnits),
  unitPriceMinor,
  taxable,
})

describe('Worked example — the §E sample rates (VAT 7.5, WHT 5)', () => {
  // 3 bags of cement @ ₦5,000.00  = ₦15,000.00
  // 2 tonnes of sand  @ ₦12,500.00 = ₦25,000.00
  // subtotal ₦40,000.00 · 10% discount ₦4,000.00 · net ₦36,000.00
  // VAT 7.5% of ₦36,000.00 = ₦2,700.00 · WHT 5% of ₦36,000.00 = ₦1,800.00
  // payable = 36,000 + 2,700 − 1,800 = ₦36,900.00
  const input = {
    type: 'invoice' as const,
    currency: 'NGN',
    lines: [line('cement', 3, 500_000), line('sand', 2, 1_250_000)],
    discountRate: percentToPpm(10),
    taxRate: percentToPpm(7.5),
    whtRate: percentToPpm(5),
  }

  it('produces every figure the PDF prints', () => {
    const t = computeTotals(input)
    expect(t.subtotal.minor).toBe(4_000_000)
    expect(t.discount.minor).toBe(400_000)
    expect(t.net.minor).toBe(3_600_000)
    expect(t.taxBase.minor).toBe(3_600_000)
    expect(t.tax.minor).toBe(270_000)
    expect(t.wht.minor).toBe(180_000)
    expect(t.payable.minor).toBe(3_690_000)
  })

  it('taxes only the flagged lines, on their share of the net', () => {
    const t = computeTotals({
      ...input,
      lines: [line('cement', 3, 500_000, true), line('labour', 1, 2_500_000, false)],
      whtRate: 0,
    })
    // subtotal 40,000.00 · discount 4,000.00 · net 36,000.00
    // cement is 15,000/40,000 of the net = 13,500.00; VAT 7.5% = 1,012.50
    expect(t.net.minor).toBe(3_600_000)
    expect(t.taxBase.minor).toBe(1_350_000)
    expect(t.tax.minor).toBe(101_250)
    expect(t.payable.minor).toBe(3_701_250)
  })

  it('takes WHT on the net, exclusive of tax', () => {
    const t = computeTotals(input)
    expect(t.wht).toEqual(money('NGN', 180_000))
    expect(t.wht.minor).not.toBe(add(t.net, t.tax).minor * 0.05)
  })
})

describe('The ordering holds for every input', () => {
  const arbLines = fc.array(
    fc.record({
      qty: fc.integer({ min: 1, max: 500 }),
      price: fc.integer({ min: 0, max: 50_000_000 }),
      taxable: fc.boolean(),
    }),
    { minLength: 1, maxLength: 20 },
  )
  const arbRate = fc.integer({ min: 0, max: 400_000 })

  it('net = subtotal − discount, and payable = net + tax − WHT', () => {
    fc.assert(
      fc.property(arbLines, arbRate, arbRate, arbRate, (raw, discount, tax, wht) => {
        const t = computeTotals({
          type: 'invoice',
          currency: 'NGN',
          lines: raw.map((r, i) => line(`l${i}`, r.qty, r.price, r.taxable)),
          discountRate: discount,
          taxRate: tax,
          whtRate: wht,
        })
        expect(t.net).toEqual(subtract(t.subtotal, t.discount))
        expect(t.payable).toEqual(subtract(add(t.net, t.tax), t.wht))
        expect(t.subtotal).toEqual(sum([...t.lineTotals], 'NGN'))
      }),
    )
  })

  it('never taxes more than the net', () => {
    fc.assert(
      fc.property(arbLines, arbRate, (raw, discount) => {
        const t = computeTotals({
          type: 'invoice',
          currency: 'NGN',
          lines: raw.map((r, i) => line(`l${i}`, r.qty, r.price, r.taxable)),
          discountRate: discount,
        })
        expect(t.taxBase.minor).toBeLessThanOrEqual(t.net.minor)
        expect(t.taxBase.minor).toBeGreaterThanOrEqual(0)
      }),
    )
  })

  it('a zero discount leaves the subtotal untouched', () => {
    fc.assert(
      fc.property(arbLines, (raw) => {
        const t = computeTotals({
          type: 'invoice',
          currency: 'NGN',
          lines: raw.map((r, i) => line(`l${i}`, r.qty, r.price)),
        })
        expect(t.net).toEqual(t.subtotal)
        expect(t.payable).toEqual(t.subtotal)
      }),
    )
  })
})

describe('Delivery documents carry no money anywhere (§G, §I, §V)', () => {
  it('refuses to total a waybill under any name', () => {
    expect(() =>
      computeTotals({ type: 'waybill', currency: 'NGN', lines: [line('cement', 3, 500_000)] }),
    ).toThrow(MoneyError)
  })

  it('refuses WHT on anything but an invoice', () => {
    for (const type of ['quotation', 'receipt'] as const) {
      expect(() =>
        computeTotals({
          type,
          currency: 'NGN',
          lines: [line('a', 1, 1000)],
          whtRate: percentToPpm(5),
        }),
      ).toThrow(MoneyError)
    }
  })

  it('refuses a negative or over-100% rate', () => {
    const base = { type: 'invoice' as const, currency: 'NGN', lines: [line('a', 1, 1000)] }
    expect(() => computeTotals({ ...base, taxRate: -1 })).toThrow(MoneyError)
    expect(() => computeTotals({ ...base, discountRate: 1_000_001 })).toThrow(MoneyError)
  })
})

describe('Fractional quantities stay exact', () => {
  it('2.5 tonnes at ₦12,345.67 rounds once, at the end', () => {
    const t = computeTotals({
      type: 'invoice',
      currency: 'NGN',
      lines: [line('sand', 2.5, 1_234_567)],
    })
    // 1_234_567 × 2.5 = 3_086_417.5 -> 3_086_418 (half up)
    expect(t.subtotal.minor).toBe(3_086_418)
  })

  it('rejects a quantity finer than the scale holds', () => {
    expect(() => quantity(1.00005)).toThrow(RangeError)
  })
})
