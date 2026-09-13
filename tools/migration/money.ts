/**
 * Legacy money, converted exactly (§Q Phase 7, Rule #3).
 *
 * §Q: "counts and totals **reconciled to the naira**." That phrase is the
 * acceptance test, and this file is where it is won or lost.
 *
 * The legacy schema types every amount as `number` — JSON floats in MAJOR
 * units. The new model is integer minor units. So every amount in the whole
 * dataset crosses that boundary exactly once, and a systematic error of one
 * kobo per document is a reconciliation nobody can close by hand.
 *
 * Two failure modes, and they pull in opposite directions:
 *
 *  · **Rounding silently.** `Math.round(1234.565 * 100)` gives an answer, and
 *    the answer may be a kobo out. Multiply by ten thousand documents and the
 *    totals do not match, with nothing to point at.
 *  · **Refusing everything.** A float that is 1234.5599999999999 in memory is
 *    *exactly* what the legacy app stored when someone typed 1234.56. Refusing
 *    it would block a migration over an artefact of how the number was
 *    written down.
 *
 * So the rule is: convert through the DECIMAL TEXT, not the binary value, and
 * refuse only when the text carries more precision than the currency has.
 * `JSON.stringify(1234.5599999999999)` is `"1234.56"` — JavaScript prints the
 * shortest string that round-trips, which is the number the person typed.
 * That is the one place a float's own formatting is trustworthy, and it is
 * exactly the right tool here.
 */

export interface Converted {
  readonly minor: number
}

export class UnconvertibleAmount extends Error {
  constructor(readonly field: string, readonly value: unknown) {
    super(`Cannot convert ${field} = ${JSON.stringify(value)} to whole minor units.`)
    this.name = 'UnconvertibleAmount'
  }
}

/**
 * A legacy major-unit amount as exact minor units.
 *
 * Throws rather than rounding. A migration that quietly adjusts somebody's
 * money is worse than one that stops and asks.
 */
export function toMinor(value: unknown, scale: number, field = 'amount'): number {
  if (value === null || value === undefined) return 0
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new UnconvertibleAmount(field, value)
  }

  // The shortest decimal string that round-trips to this float — which is the
  // number as it was written, not as it is stored.
  const text = String(value)
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (match === null) {
    // Exponent form, for a value far outside anything a document holds.
    throw new UnconvertibleAmount(field, value)
  }

  const [, sign, whole, fraction = ''] = match
  const places = placesFor(scale)
  if (fraction.length > places) {
    // More precision than the currency has. §Q asks for reconciliation to the
    // naira, and half a kobo cannot be reconciled to anything — a person
    // decides what it should have been.
    throw new UnconvertibleAmount(field, value)
  }

  const minor = Number(`${whole}${fraction.padEnd(places, '0')}`)
  if (!Number.isSafeInteger(minor)) throw new UnconvertibleAmount(field, value)
  return sign === '-' ? -minor : minor
}

function placesFor(scale: number): number {
  let places = 0
  let remaining = scale
  while (remaining > 1) {
    remaining /= 10
    places += 1
  }
  return places
}

/**
 * What a legacy document's own arithmetic says, versus what ours does.
 *
 * The legacy app stored `total` as a number it had already computed. The new
 * model recomputes totals from the lines (Rule #3 — totals are never stored as
 * truth). Those two can disagree, and when they do it is not a rounding
 * artefact to be smoothed over: it means the legacy row's stored total does
 * not match its own lines, and somebody's invoice says one thing while its
 * arithmetic says another.
 *
 * Reported, never corrected. The migration's job is to carry the data across
 * faithfully and to SAY where it disagrees with itself.
 */
export interface TotalCheck {
  readonly storedMinor: number
  readonly recomputedMinor: number
  readonly agrees: boolean
  readonly differenceMinor: number
}

export function checkTotal(storedMinor: number, recomputedMinor: number): TotalCheck {
  return {
    storedMinor,
    recomputedMinor,
    agrees: storedMinor === recomputedMinor,
    differenceMinor: recomputedMinor - storedMinor,
  }
}
