/**
 * The policies say what the app does (§P, §T).
 *
 * The point of generating them from `inventory.ts` is that they cannot drift
 * from the code — so these assert the DIRECTION of that dependency. A field
 * added to the inventory and missing from the privacy text is a red test, not
 * a quiet inaccuracy somebody finds during a store review.
 *
 * And they enforce the two rules that matter more than completeness: nothing
 * claims a certification, and nothing invents a business fact.
 */

import { describe, expect, it } from 'vitest'

import { DATA_CATEGORIES, PROCESSORS, STORAGE_KEYS } from './inventory'
import { LEGAL_DOCUMENTS, documentById } from './documents'
import { PLACEHOLDERS, fill, undeclared, unfilled } from './placeholders'

const all = LEGAL_DOCUMENTS.map((d) => d.body).join('\n')

describe('The privacy policy is generated from the real inventory', () => {
  const privacy = documentById('privacy').body

  it('describes every category the app actually collects', () => {
    for (const category of DATA_CATEGORIES) {
      expect(privacy, `${category.id} is collected and undisclosed`).toContain(category.what)
      expect(privacy, `${category.id} has no stated purpose`).toContain(category.why)
    }
  })

  it('names every processor and what each one sees', () => {
    for (const processor of PROCESSORS) {
      expect(privacy, `${processor.name} is undisclosed`).toContain(processor.name)
      expect(privacy).toContain(processor.sees)
    }
  })

  /** GDPR Art. 6 wants a basis per purpose, not one blanket sentence. */
  it('gives a lawful basis for each one', () => {
    for (const category of DATA_CATEGORIES) {
      const sentence = privacy.slice(privacy.indexOf(category.what))
      expect(sentence.slice(0, 400)).toMatch(/to provide|legitimate interest|legal obligation|consent/)
    }
  })

  /** Both routes are in the app already; the policy must point at them. */
  it('points at the export and deletion the app already has', () => {
    expect(privacy).toContain('Export all my data')
    expect(privacy).toContain('Delete this business')
  })

  it('says who is controller for a customer’s details, because it is not us', () => {
    expect(privacy).toContain('you are the controller and we are the processor')
  })
})

describe('The storage note matches the keys the app really sets', () => {
  const storage = documentById('storage').body

  it('lists every key', () => {
    for (const key of STORAGE_KEYS) expect(storage, key.key).toContain(key.key)
  })

  /**
   * The claim that justifies having no consent banner. If a non-essential key
   * is ever added, this goes red and the banner question reopens.
   */
  it('holds only strictly necessary keys, which is why there is no banner', () => {
    expect(STORAGE_KEYS.every((key) => key.essential)).toBe(true)
    expect(storage).toContain('DocFlow sets no cookies')
  })
})

describe('The terms cover what the product actually operates', () => {
  const terms = documentById('terms').body

  /** Limits you never disclosed are harder to enforce. */
  it('discloses the limits, so throttling and suspension are enforceable', () => {
    expect(terms).toContain('rate limits and usage limits')
  })

  /** §U: store billing cancels in the store, and saying otherwise gets rejected. */
  it('says cancellation happens in the store, not here', () => {
    expect(terms).toContain('You cancel in the store, not here')
    expect(terms).toMatch(/renews automatically/i)
  })

  /** Rule #6, in the terms rather than only in the code. */
  it('promises export stays free after a subscription lapses', () => {
    expect(terms).toContain('Export is free forever')
  })

  /** Check 10: the price shown is the total. */
  it('states there are no fees on top', () => {
    expect(terms).toContain('There are no fees on top')
  })

  /** Check 17, and it has to be in the terms as well as the privacy policy. */
  it('states a minimum age', () => {
    expect(terms).toMatch(/at least 16/)
  })
})

describe('Nothing is claimed that cannot be defended', () => {
  it.each([
    'GDPR compliant',
    'SOC 2',
    'HIPAA',
    'ISO 27001',
    'bank-level',
    'military-grade',
    'certified',
    '100% secure',
    'guaranteed',
  ])('never says %s', (claim) => {
    expect(all.toLowerCase()).not.toContain(claim.toLowerCase())
  })

  /** Honesty in the other direction: the limit of what security means here. */
  it('admits no system is perfectly secure', () => {
    expect(documentById('privacy').body).toContain('No system is perfectly secure')
  })
})

describe('No business fact is invented', () => {
  /** Every token used must be declared, or the list handed over is incomplete. */
  it('declares every placeholder it uses', () => {
    expect(undeclared(all)).toEqual([])
  })

  it('still carries them all, unfilled, until somebody fills them', () => {
    const used = unfilled(all)
    for (const token of ['LEGAL_ENTITY_NAME', 'REGISTERED_ADDRESS', 'SUPPORT_EMAIL', 'GOVERNING_LAW']) {
      expect(used, `${token} appears to have been guessed`).toContain(token)
    }
  })

  /** A default is an invention that survives review by not looking like one. */
  it('gives no placeholder a default value', () => {
    for (const placeholder of PLACEHOLDERS) {
      expect(Object.keys(placeholder)).toEqual(['token', 'what', 'why'])
    }
  })

  /**
   * Filling leaves the unfilled ones VISIBLE. A half-finished policy that
   * still shows a token gets fixed; one that silently dropped the line ships
   * looking complete with a legal requirement missing.
   */
  it('leaves what it cannot fill on the page', () => {
    const filled = fill('by [[LEGAL_ENTITY_NAME]] at [[REGISTERED_ADDRESS]]', {
      LEGAL_ENTITY_NAME: 'Example Ltd',
    })
    expect(filled).toBe('by Example Ltd at [[REGISTERED_ADDRESS]]')
  })
})
