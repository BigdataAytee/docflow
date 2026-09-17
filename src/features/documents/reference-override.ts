/**
 * §G's pencil: the owner's own document number (§G, §M, §K).
 *
 * "Number & dates" carries a pencil beside the reference, and it did nothing —
 * the control was visible and inert for as long as it has existed. This is
 * what it writes to.
 *
 * Who needs it: somebody migrating from a paper book or from another app,
 * whose next invoice has to be DR-INV-0413 because that is what follows the
 * one they wrote last week. Without it they run two numbering systems side by
 * side, and a customer asking about "invoice 412" is a question nobody can
 * answer.
 *
 * WHAT THIS DOES NOT DO, and each is a decision rather than an omission:
 *
 *  · **It never repairs what was typed.** A reference is quoted back over the
 *    phone and typed into somebody's ledger. Silently upper-casing it or
 *    stripping a space would mean the document does not carry the number the
 *    owner believes it does (§K: validate without destroying the input).
 *  · **It never checks uniqueness here.** §M puts
 *    `unique (company_id, type, issued_reference)` on the table, so the
 *    database is the only place that can answer "is this taken" without a
 *    race. A check in the app would be a guess that goes stale between the
 *    asking and the issuing.
 *  · **It is only about ISSUING.** An issued reference is frozen (Rule #5);
 *    the pencil edits a draft, and after issue there is nothing to edit.
 */

/** Why an override cannot be used. A token; the words are the catalogue's. */
export type ReferenceProblem =
  /** Nothing typed. Clearing the box means "use the generated one". */
  | 'empty'
  /** Long enough to break every layout that has to print it. */
  | 'too_long'
  /**
   * Characters that do not survive the journey.
   *
   * A reference goes into a filename, a URL when a link is shared, and a
   * column somebody reads aloud. Slashes break the first two and control
   * characters break all three, so they are refused rather than silently
   * swapped for something else.
   */
  | 'unusable'

/** §I prints this in a fixed-width column; past this it wraps or clips. */
export const REFERENCE_MAX = 32

/*
 * Letters, digits, and the three separators every numbering scheme in the
 * wild actually uses. Deliberately NOT a format: a business's own scheme is
 * theirs, and §J's lesson is that inventing a rule for somebody else's market
 * is how a product refuses work it should accept.
 */
const USABLE = /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/

/**
 * What is wrong with this override, or null when it can be used as typed.
 *
 * Trailing and leading spaces are trimmed BEFORE judging, because they are
 * invisible and nobody means them — that is the one repair made, and it is
 * made to the value that gets stored too, so what is judged is what is used.
 */
export function referenceProblem(value: string): ReferenceProblem | null {
  const trimmed = value.trim()
  if (trimmed === '') return 'empty'
  if (trimmed.length > REFERENCE_MAX) return 'too_long'
  // A slash would break a filename and a shared link; both carry this value.
  if (trimmed.includes('/')) return 'unusable'
  if (!USABLE.test(trimmed)) return 'unusable'
  return null
}

/**
 * The value to store, or undefined to go back to the generated sequence.
 *
 * An owner who clears the box is asking for the app's own numbering again,
 * which is a real choice and not an error — so an empty string is `undefined`
 * here rather than a problem to report.
 */
export function overrideToStore(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}
