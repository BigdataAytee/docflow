/**
 * Splitting an amount across parts without losing or inventing a minor unit.
 *
 * Used wherever a document-level figure has to be attributed back to lines
 * (a document discount deciding each line's taxable base) and wherever a
 * payment is spread over invoices. Rule #4: the parts always sum to the whole.
 */

import { type Money, MoneyError, money } from './money'

/**
 * Largest-remainder distribution of `total` in proportion to `weights`.
 *
 * The returned parts sum EXACTLY to `total`. Where remainders tie, the earlier
 * line wins, so the split is deterministic and reproducible across devices —
 * two phones computing the same document get byte-identical totals.
 */
export function distribute(total: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) {
    if (total.minor !== 0) {
      throw new MoneyError('Cannot distribute a non-zero amount across zero parts.')
    }
    return []
  }
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      throw new MoneyError(`Distribution weights must be finite and non-negative, got ${w}.`)
    }
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0)

  // No weight to go on: spread as evenly as the minor unit allows.
  if (totalWeight === 0) {
    return distribute(total, weights.map(() => 1))
  }

  const sign = total.minor < 0 ? -1 : 1
  const absTotal = Math.abs(total.minor)

  const exact = weights.map((w) => (absTotal * w) / totalWeight)
  const floors = exact.map((e) => Math.floor(e))
  const distributed = floors.reduce((a, b) => a + b, 0)
  let remaining = absTotal - distributed

  const order = exact
    .map((e, index) => ({ index, remainder: e - Math.floor(e) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  const parts = [...floors]
  for (const { index } of order) {
    if (remaining <= 0) break
    parts[index] = (parts[index] ?? 0) + 1
    remaining -= 1
  }

  return parts.map((p) => money(total.currency, sign * p))
}
