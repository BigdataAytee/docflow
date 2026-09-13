/**
 * The mandatory review (§N).
 *
 * The rule is not "a review screen exists" but "no path around it does", so
 * these test the SHAPE as much as the behaviour.
 */

import { describe, expect, it } from 'vitest'

import * as review from './review'
import { NotReviewed, confirm, continueManually, reviewOf } from './review'
import { extract } from './extract'

const opts = { profile: { locale: 'EN-NG' } as const, currency: 'NGN' }
const at = '2026-09-13T10:00:00Z'

describe('Nothing reaches a record without a person (§N)', () => {
  it('offers no way to turn an extraction into a draft directly', () => {
    // If a `toDraft(extraction)` existed, every future caller would have a way
    // past the screen, and §N's rule would hold only until someone was in a
    // hurry. The module's surface IS the guarantee.
    const exported = review as Record<string, unknown>
    const doors = Object.keys(exported).filter((name) => {
      const value = exported[name]
      // Functions only — an error class is `typeof 'function'` too, and is
      // not a way through.
      return typeof value === 'function' && !/^[A-Z]/.test(name)
    })
    expect(doors.sort()).toEqual(['confirm', 'continueManually', 'reviewOf'])

    // And the one that produces a draft needs a ReviewState, which only
    // `reviewOf` makes — an Extraction alone cannot reach `confirm`.
    expect(confirm.length).toBe(3)
  })

  it('takes the EDITED values, not the extracted ones', () => {
    const state = reviewOf(extract('3 bags of cement at 5000', opts))
    const draft = confirm(state, { customerName: 'Okoro & Sons' }, at)

    expect(draft.customerName).toBe('Okoro & Sons')
    expect(draft.confirmedAt).toBe(at)
  })

  it('marks a review unconfirmed until somebody confirms it', () => {
    expect(reviewOf(extract('3 bags of cement at 5000', opts)).confirmed).toBe(false)
  })

  it('refuses to confirm a draft with no lines', () => {
    const state = reviewOf(extract('hello there', opts))
    expect(() => confirm(state, {}, at)).toThrow(NotReviewed)
  })
})

describe('What must be highlighted (§N)', () => {
  it('flags every field the text did not carry', () => {
    const state = reviewOf(extract('3 bags of cement at 5000', opts))
    const fields = state.flags.map((f) => f.field)
    expect(fields).toContain('type')
    expect(fields).toContain('customerName')
  })

  it('flags a line whose price was not readable, with the text it came from', () => {
    const state = reviewOf(extract('4 bags of rice at abc', opts))
    const unreadable = state.flags.filter((f) => f.flag === 'unreadable')
    expect(unreadable.length).toBeGreaterThan(0)
    expect(unreadable[0]?.source).toContain('abc')
  })

  it('never carries a confidence number (§N)', () => {
    const state = reviewOf(extract('4 bags of rice at abc', opts))
    for (const flag of state.flags) {
      // §N: "model confidence never displayed as calibrated probability." A
      // rules extractor has no probability at all, so "87% sure" would be a
      // number with nothing whatsoever behind it.
      expect(Object.keys(flag)).not.toContain('confidence')
      expect(Object.keys(flag)).not.toContain('score')
      expect(typeof flag.flag).toBe('string')
    }
  })
})

describe('Failure keeps what it recovered (§N)', () => {
  it('hands back the partial work, labelled unconfirmed', () => {
    const extraction = extract('3 bags of cement at 5000 and then something unreadable', opts)
    const partial = continueManually(extraction)

    // Discarding what it managed to read makes the person type it twice,
    // which is the opposite of what the feature is for.
    expect(partial.items.length).toBeGreaterThan(0)
    expect(partial.originalText).toBe(extraction.originalText)
    expect(partial.unconfirmed).toBe(true)
  })
})
