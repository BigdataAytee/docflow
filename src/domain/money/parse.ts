/**
 * Text a person typed, as an exact count of minor units (Rule #3).
 *
 * The app had one of these already, inline and wrong in a small way:
 * `Math.round(Number(text) * scale)`. `Number()` is the problem, not the
 * float — it coerces things that are not amounts, and every coercion lands as
 * money in someone's ledger:
 *
 *   Number('')      -> 0     a BLANK becomes zero, not a refusal
 *   Number(' ')     -> 0
 *   Number('0x10')  -> 16
 *   Number('5e2')   -> 500
 *
 * A blank becoming zero is the dangerous one: the record saves, the invoice
 * does not settle, and nothing anywhere says why.
 *
 * The float does matter in exactly one place — `Math.round(1.005 * 100)` is
 * 100, not 101 — so more precision than the currency has is refused rather
 * than rounded away.
 *
 * A sibling of this lives in `supabase/functions/payment-webhook/rules.ts`.
 * They are deliberately separate: that one runs in Deno, parses what a
 * PROVIDER sent, and is strict about formats a person would never type. This
 * one parses what a person typed and is forgiving about the way people write
 * money — grouping separators, a currency symbol, spaces.
 */

export interface ParseOptions {
  /** Minor units per major unit: 100 for NGN, 1 for a zero-decimal currency. */
  readonly scale: number
  /**
   * The decimal mark this locale writes. FR and ES write "1.234,56"; EN
   * writes "1,234.56". Getting it backwards is a hundredfold error that
   * looks completely ordinary on the page (§S).
   */
  readonly decimal?: '.' | ','
}

/**
 * Returns the minor units, or null when the text is not an amount.
 *
 * Null rather than zero, always. Zero is a real amount someone may mean, and
 * conflating "nothing typed" with "nothing owed" is how a blank becomes money.
 */
export function parseAmount(text: string, options: ParseOptions): number | null {
  const { scale, decimal = '.' } = options
  const grouping = decimal === '.' ? ',' : '.'

  // Strip what a person legitimately writes around a number: a currency
  // symbol or code, spaces (including the non-breaking kind that arrives from
  // a paste), and the grouping separator.
  let cleaned = text
    .trim()
    // The class names the non-breaking spaces as ESCAPES, not literals: they
    // arrive from pastes and from locales that group with one, `\s` does not
    // cover the narrow one, and a literal would be invisible in the source.
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/^[^\d,.-]+/, '')
    .replace(/[^\d,.-]+$/, '')
  if (cleaned === '') return null

  cleaned = cleaned.split(grouping).join('')
  if (decimal === ',') cleaned = cleaned.replace(',', '.')

  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(cleaned)
  if (match === null) return null

  const [, sign, whole, fraction = ''] = match
  const places = placesFor(scale)
  if (places === null) return null
  if (fraction.length > places) return null

  const minor = Number(`${whole}${fraction.padEnd(places, '0')}`)
  if (!Number.isSafeInteger(minor)) return null
  return sign === '-' ? -minor : minor
}

/** 100 -> 2, 1 -> 0, 1000 -> 3. Null for a scale that is not a power of ten. */
function placesFor(scale: number): number | null {
  if (!Number.isInteger(scale) || scale < 1) return null
  let places = 0
  let remaining = scale
  while (remaining > 1) {
    if (remaining % 10 !== 0) return null
    remaining /= 10
    places += 1
  }
  return places
}
