/**
 * Formatting money for display (§K: number and currency formatting follow the
 * locale through the same layer that formats money).
 *
 * Presentation only. The value stays integer minor units everywhere else —
 * this never returns something another calculation can consume.
 */

import type { Money } from '../../domain/money/money'
import { minorUnitsFor, symbolFor } from '../../domain/locale/bank-fields'

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
