/**
 * Document totals. The single authority for every printed and displayed amount
 * (§I). No model, no server and no cached rollup ever overrides this (§N, §C).
 *
 * Ordering, per §G step 3 and §I:
 *
 *   subtotal      = Σ line totals
 *   discount      = subtotal × discountRate            (document level, %)
 *   net           = subtotal − discount
 *   taxBase       = the net attributed to tax-flagged lines
 *   tax           = taxBase × taxRate                  (VAT / GST / Sales tax / TVA)
 *   wht           = net × whtRate                      (invoices only, withheld)
 *   payable       = net + tax − wht
 *
 * The document discount is attributed back to lines pro rata by line total
 * (largest remainder), so the tax base is exact when only some lines are taxed
 * and the parts still sum to the net.
 *
 * WHT is taken on the net, exclusive of tax. The sample rates in §E (VAT 7.5 /
 * WHT 5) are product samples, not tax advice — §W keeps per-market validation
 * open. What is fixed here is the ORDERING, which the property tests pin.
 */

import { distribute } from './distribute'
import {
  type CurrencyCode,
  type Money,
  type RatePpm,
  MoneyError,
  add,
  applyRate,
  money,
  subtract,
  sum,
  zero,
} from './money'
import {
  type DocumentType,
  type LineItem,
  QUANTITY_SCALE,
  carriesMoney,
} from '../documents/types'

export interface TotalsInput {
  readonly type: DocumentType
  readonly currency: CurrencyCode
  readonly lines: readonly LineItem[]
  /** Document-level discount. Parts per million; 10% is 100_000. */
  readonly discountRate?: RatePpm
  /** Locale-labelled tax (VAT / GST / Sales tax / TVA). */
  readonly taxRate?: RatePpm
  /** Withholding tax. Invoices only — ignored, loudly, on any other type. */
  readonly whtRate?: RatePpm
}

export interface DocumentTotals {
  readonly currency: CurrencyCode
  readonly lineTotals: readonly Money[]
  readonly subtotal: Money
  readonly discount: Money
  readonly net: Money
  readonly taxBase: Money
  readonly tax: Money
  readonly wht: Money
  readonly payable: Money
}

/** One line's total: unit price × quantity, rounded half-up once, at the end. */
export function lineTotal(currency: CurrencyCode, line: LineItem): Money {
  if (line.unitPriceMinor === undefined) return zero(currency)
  const unit = money(currency, line.unitPriceMinor)
  // Rounds once, from the exact product — never price-rounds then multiplies.
  return money(currency, mulQuantity(unit.minor, line.quantityMilli))
}

function mulQuantity(unitMinor: number, quantityMilli: number): number {
  const product = BigInt(unitMinor) * BigInt(quantityMilli)
  const scale = BigInt(QUANTITY_SCALE)
  const negative = product < 0n
  const absProduct = negative ? -product : product
  const quotient = absProduct / scale
  const remainder = absProduct % scale
  const rounded = remainder * 2n >= scale ? quotient + 1n : quotient
  const result = negative ? -rounded : rounded
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new MoneyError('Line total is outside the safe integer range.')
  }
  return Number(result)
}

export function computeTotals(input: TotalsInput): DocumentTotals {
  const { type, currency, lines } = input

  if (!carriesMoney(type)) {
    throw new MoneyError(
      `A ${type} carries no money anywhere — no prices, tax, totals or payment instructions (v6 §G, §V).`,
    )
  }

  const discountRate = input.discountRate ?? 0
  const taxRate = input.taxRate ?? 0
  const whtRate = type === 'invoice' ? (input.whtRate ?? 0) : 0

  if (input.whtRate && type !== 'invoice') {
    throw new MoneyError(`Withholding tax applies to invoices only, not to a ${type} (v6 §I).`)
  }
  for (const [name, rate] of [
    ['discount', discountRate],
    ['tax', taxRate],
    ['WHT', whtRate],
  ] as const) {
    if (rate < 0) throw new MoneyError(`The ${name} rate cannot be negative.`)
  }
  if (discountRate > 1_000_000) throw new MoneyError('The discount rate cannot exceed 100%.')

  const lineTotals = lines.map((line) => lineTotal(currency, line))
  const subtotal = sum(lineTotals, currency)

  const discount = applyRate(subtotal, discountRate)
  const net = subtract(subtotal, discount)

  // Attribute the document discount back to lines so the tax base is exact.
  const netByLine = distribute(net, lineTotals.map((m) => Math.abs(m.minor)))
  const taxBase = sum(
    netByLine.filter((_, i) => lines[i]?.taxable === true),
    currency,
  )

  const tax = applyRate(taxBase, taxRate)
  const wht = applyRate(net, whtRate)
  const payable = subtract(add(net, tax), wht)

  return { currency, lineTotals, subtotal, discount, net, taxBase, tax, wht, payable }
}
