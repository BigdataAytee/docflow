/**
 * Exact money. v6 Rule #4 — money is never inferred.
 *
 * Amounts are INTEGER MINOR UNITS (kobo, pence, cents) carried alongside their
 * currency. No binary float ever touches an amount (§K). Values are held in
 * `number` because every amount is a safe integer and it round-trips through
 * SQLite, JSON and the sync payloads unchanged; every constructor asserts
 * integrality and safe range, and intermediate products are computed in BigInt
 * so nothing silently loses precision.
 *
 * Currencies never mix (§G — "NGN and USD are never added together").
 */

export type CurrencyCode = string

export interface Money {
  readonly currency: CurrencyCode
  readonly minor: number
}

/** A rate in parts per million. 7.5% -> 75_000. Integer, so 7.5% is exact. */
export type RatePpm = number

export const PPM = 1_000_000

export class MoneyError extends Error {}

export class CurrencyMismatchError extends MoneyError {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Cannot combine ${a} with ${b} — currency buckets never mix (v6 §G).`)
    this.name = 'CurrencyMismatchError'
  }
}

const isValidCurrency = (c: unknown): c is CurrencyCode =>
  typeof c === 'string' && /^[A-Z]{3}$/.test(c)

function assertMinor(minor: number): void {
  if (!Number.isInteger(minor)) {
    throw new MoneyError(`Amount must be an integer of minor units, got ${minor}.`)
  }
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError(`Amount ${minor} is outside the safe integer range.`)
  }
}

export function money(currency: CurrencyCode, minor: number): Money {
  if (!isValidCurrency(currency)) {
    throw new MoneyError(`Currency must be an ISO-4217 alpha-3 code, got ${String(currency)}.`)
  }
  assertMinor(minor)
  return Object.freeze({ currency, minor })
}

export const zero = (currency: CurrencyCode): Money => money(currency, 0)

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency)
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b)
  return money(a.currency, a.minor + b.minor)
}

export function subtract(a: Money, b: Money): Money {
  sameCurrency(a, b)
  return money(a.currency, a.minor - b.minor)
}

export const negate = (a: Money): Money => money(a.currency, -a.minor)

export const abs = (a: Money): Money => money(a.currency, Math.abs(a.minor))

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  sameCurrency(a, b)
  return a.minor < b.minor ? -1 : a.minor > b.minor ? 1 : 0
}

export const equals = (a: Money, b: Money): boolean =>
  a.currency === b.currency && a.minor === b.minor

export const isZero = (a: Money): boolean => a.minor === 0
export const isNegative = (a: Money): boolean => a.minor < 0
export const isPositive = (a: Money): boolean => a.minor > 0

export const max = (a: Money, b: Money): Money => (compare(a, b) >= 0 ? a : b)
export const min = (a: Money, b: Money): Money => (compare(a, b) <= 0 ? a : b)

/** Sum within one currency. An empty list needs the currency stated explicitly. */
export function sum(amounts: readonly Money[], currency?: CurrencyCode): Money {
  const first = amounts[0]
  if (first === undefined) {
    if (currency === undefined) {
      throw new MoneyError('Cannot sum an empty list without an explicit currency.')
    }
    return zero(currency)
  }
  const ccy = currency ?? first.currency
  return amounts.reduce((acc, m) => add(acc, m), zero(ccy))
}

/**
 * Round-half-up-away-from-zero of `value * numerator / denominator`.
 * The product is taken in BigInt, so no intermediate overflows or rounds.
 */
export function mulDivRoundHalfUp(value: number, numerator: number, denominator: number): number {
  assertMinor(value)
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new MoneyError('mulDivRoundHalfUp takes integer numerator and denominator.')
  }
  if (denominator === 0) throw new MoneyError('Division by zero.')

  const v = BigInt(value)
  const n = BigInt(numerator)
  const d = BigInt(denominator)

  const product = v * n
  const negative = product < 0n !== d < 0n
  const absProduct = product < 0n ? -product : product
  const absD = d < 0n ? -d : d

  const quotient = absProduct / absD
  const remainder = absProduct % absD
  // Half-up: round away from zero when the remainder is at least half.
  const rounded = remainder * 2n >= absD ? quotient + 1n : quotient

  const result = negative ? -rounded : rounded
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new MoneyError('Result is outside the safe integer range.')
  }
  return Number(result)
}

/** `amount × rate`, rounded half-up to the minor unit. */
export function applyRate(amount: Money, rate: RatePpm): Money {
  if (!Number.isInteger(rate)) throw new MoneyError('Rate must be an integer of parts per million.')
  return money(amount.currency, mulDivRoundHalfUp(amount.minor, rate, PPM))
}

/** Convert a human percentage to parts per million, exactly or not at all. */
export function percentToPpm(percent: number): RatePpm {
  if (!Number.isFinite(percent)) throw new MoneyError(`Rate ${percent} is not a finite number.`)
  const ppm = percent * 10_000
  const rounded = Math.round(ppm)
  if (Math.abs(ppm - rounded) > 1e-6) {
    throw new MoneyError(
      `Rate ${percent}% needs more precision than parts per million allows.`,
    )
  }
  return rounded
}
