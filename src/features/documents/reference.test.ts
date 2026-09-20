/**
 * The number a document gets, and the number it is offered (§G, §M).
 *
 * §M puts a unique (company, type, issued_reference) constraint on the table,
 * so a colliding reference is refused by the database — correctly, and at the
 * worst possible moment, with a customer waiting. These are about never
 * getting there.
 */

import { describe, expect, it } from 'vitest'

import { nextSequence, parseReference, suggestedReference } from './reference'

/**
 * The next number that is not already taken (§G, §M).
 *
 * Every issue path worked the sequence out as "how many of this type exist,
 * plus one" — the next free number only while nothing has ever been removed
 * and nobody has ever typed their own.
 */
describe('The next number steps over what exists, not into it', () => {
  /**
   * THE ONE THIS IS FOR. Void one of five and the count says four, so the
   * next document is offered INV-0004 — which exists, and which §M's unique
   * constraint refuses with the customer waiting.
   */
  it('goes past the highest issued, not past the count', () => {
    const issued = ['INV-0001', 'INV-0002', 'INV-0003', 'INV-0005']
    expect(nextSequence(issued), 'the count would have said 5').toBe(6)
  })

  /**
   * A HAND-TYPED NUMBER IN THE SAME SERIES COUNTS. Somebody who jumps ahead
   * to INV-0413 has used that number; the next automatic one must not walk
   * back into it.
   */
  it('steps over a hand-typed number in the same series', () => {
    expect(nextSequence(['INV-0001', 'INV-0413'])).toBe(414)
  })

  /**
   * AND A NUMBER FROM ANOTHER SERIES IS LEFT ALONE. `DR-INV-0413` is the
   * owner's own book, not this prefix's: it cannot collide with `INV-…`, so
   * dragging the automatic series up to 414 to avoid it would burn four
   * hundred numbers for nothing.
   */
  it('leaves a number from a different series out of it', () => {
    expect(nextSequence(['INV-0001', 'DR-INV-0413'])).toBe(2)
  })

  /** Drafts have no reference yet, which is the whole reason this exists. */
  it('ignores drafts and anything unparseable', () => {
    expect(nextSequence([null, undefined, '', 'not a reference', 'INV-0007'])).toBe(8)
  })

  it('starts at one on an empty book', () => {
    expect(nextSequence([])).toBe(1)
  })

  /** And the suggestion is a real reference, not an ellipsis. */
  it('offers a number a person could read back over the phone', () => {
    const suggested = suggestedReference({
      prefix: 'INV',
      references: ['INV-0004'],
      deviceId: 'device-one',
    })
    expect(suggested).toContain('INV-0005')
    expect(suggested, 'the machinery is showing through').not.toContain('\u2026')
    expect(parseReference(suggested)?.sequence).toBe(5)
  })
})
