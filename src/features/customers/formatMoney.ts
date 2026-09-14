/**
 * Formatting money for display (§K: number and currency formatting follow the
 * locale through the same layer that formats money).
 *
 * Presentation only. The value stays integer minor units everywhere else —
 * this never returns something another calculation can consume.
 */

import type { Money } from '../../domain/money/money'
import { minorUnitsFor, symbolFor } from '../../domain/locale/bank-fields'

/**
 * The same amount, shortened for a dashboard — "₦95K", "₦1.24M".
 *
 * DISPLAY ONLY, and deliberately paired with `formatMoney` at every call
 * site: the short form goes on screen and the exact one goes to assistive
 * technology, so the precision is shortened rather than lost. Rule #3 is
 * untouched — nothing here returns a value another calculation can consume,
 * and the stored amount stays integer minor units.
 *
 * `Intl`'s compact notation rather than a hand-rolled divide-by-thousand: it
 * knows that some locales group by ten-thousands rather than thousands, which
 * a `/1000 + "K"` never will.
 */
export function formatMoneyCompact(amount: Money, locale = 'en-NG'): string {
  const minorUnits = minorUnitsFor(amount.currency)
  const major = amount.minor / minorUnits

  // Below a thousand there is nothing to shorten, and "₦950" reads worse as
  // "₦0.95K" than it does in full.
  if (Math.abs(major) < 1000) return formatMoney(amount, locale)

  const digits = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(Math.abs(major))
  return `${amount.minor < 0 ? '-' : ''}${symbolFor(amount.currency)}${digits}`
}

export function formatMoney(amount: Money, locale = 'en-NG'): string {
  const minorUnits = minorUnitsFor(amount.currency)
  const major = amount.minor / minorUnits
  const fractionDigits = minorUnits === 1 ? 0 : 2
  const digits = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(major))
  return `${amount.minor < 0 ? '-' : ''}${symbolFor(amount.currency)}${digits}`
}
