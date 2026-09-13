/**
 * §T's listing generator, tested for the one property that makes it worth
 * generating at all: it cannot drift from the terminology table.
 *
 * A hand-written listing is correct on the day it is written. The failure this
 * file exists to prevent is the quiet one six months later — a reviewer renames
 * a type, every screen and PDF follows because Rule 4 makes them, and the store
 * listing still says the old word in the one place a user reads before
 * installing.
 */

import { describe, expect, it } from 'vitest'

import { EN_GB, EN_NG, ES, FR, TERMINOLOGY_TABLES, LAUNCH_LOCALES } from '../domain/locale/data/terminology'
import type { TerminologyTable } from '../domain/locale/types'
import { LOCALE_LISTING_INPUTS } from './keywords'
import {
  APPLE_KEYWORD_FIELD_MAX,
  APPLE_TITLE_MAX,
  type LocaleListingInput,
  charactersIn,
  listingFor,
} from './listing'

const approved = (table: TerminologyTable): TerminologyTable => ({
  ...table,
  reviewStatus: 'approved',
  reviewedBy: 'a native speaker, in a test',
})

const inputFor = (locale: string): LocaleListingInput => {
  const input = LOCALE_LISTING_INPUTS[locale]
  if (input === undefined) throw new Error(`no listing input for ${locale}`)
  return input
}

const wordsOf = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0)

describe('The listing is derived, not written (§T, Rule 4)', () => {
  it('follows a renamed type into the title', () => {
    const renamed: TerminologyTable = {
      ...EN_NG,
      types: {
        ...EN_NG.types,
        invoice: { ...EN_NG.types.invoice, label: 'Sales Bill', pluralLabel: 'Sales Bills' },
      },
    }

    expect(listingFor(EN_NG, inputFor('EN-NG')).title).toContain(EN_NG.types.invoice.label)
    expect(listingFor(renamed, inputFor('EN-NG')).title).toContain('Sales Bill')
  })

  it('follows a renamed delivery document into the subtitle', () => {
    // The real difference between two shipped tables, not a fabricated one:
    // EN-NG says Waybill and EN-GB says Delivery note.
    const ng = listingFor(EN_NG, inputFor('EN-NG'))
    const gb = listingFor(EN_GB, inputFor('EN-GB'))

    expect(ng.subtitle).toContain(EN_NG.types.waybill.pluralLabel)
    expect(gb.subtitle).toContain(EN_GB.types.waybill.pluralLabel)
    expect(ng.subtitle).not.toEqual(gb.subtitle)
  })

  it('reproduces §T’s own published examples exactly', () => {
    // §T: "'DocFlow: Facture & Devis' (FR), 'DocFlow: Factura y Cotización'
    // (ES)". French typography takes a space before the colon.
    expect(listingFor(FR, inputFor('FR')).title).toBe('DocFlow : Facture & Devis')
    expect(listingFor(ES, inputFor('ES')).title).toBe('DocFlow: Factura y Cotización')
  })

  it('covers every launch locale', () => {
    for (const locale of LAUNCH_LOCALES) {
      expect(TERMINOLOGY_TABLES[locale], `${locale} has no terminology table`).toBeDefined()
      expect(LOCALE_LISTING_INPUTS[locale], `${locale} has no listing input`).toBeDefined()
    }
  })
})

describe('Nothing unreviewed is submittable (CLAUDE.md)', () => {
  it('blocks every locale whose table is not approved', () => {
    for (const locale of LAUNCH_LOCALES) {
      const table = TERMINOLOGY_TABLES[locale]
      if (table === undefined || table.reviewStatus === 'approved') continue
      const listing = listingFor(table, inputFor(locale))
      expect(listing.submittable, `${locale} was submittable while ${table.reviewStatus}`).toBe(
        false,
      )
      expect(listing.blockers.some((b) => b.field === 'locale')).toBe(true)
    }
  })

  it('drops exactly that blocker once a native speaker signs the table off', () => {
    const before = listingFor(EN_NG, inputFor('EN-NG'))
    const after = listingFor(approved(EN_NG), inputFor('EN-NG'))

    expect(before.blockers.filter((b) => b.field === 'locale')).toHaveLength(1)
    expect(after.blockers.filter((b) => b.field === 'locale')).toHaveLength(0)
    // And nothing else moved: approving a table is not a licence to ship a
    // title that does not fit.
    expect(after.blockers.map((b) => b.field)).toEqual(
      before.blockers.filter((b) => b.field !== 'locale').map((b) => b.field),
    )
  })
})

describe('Apple’s caps are reported, never silently applied', () => {
  it('returns the whole title and names the overflow', () => {
    const listing = listingFor(EN_NG, inputFor('EN-NG'))
    const overflow = listing.blockers.find((b) => b.field === 'title')

    expect(charactersIn(listing.title)).toBeGreaterThan(APPLE_TITLE_MAX)
    expect(overflow?.reason).toContain(String(charactersIn(listing.title)))
    // The point: the caller gets the full string to trim, not a stump.
    expect(listing.title.endsWith('…')).toBe(false)
    expect(listing.title).toContain('Maker')
  })

  it('counts characters, not UTF-16 code units', () => {
    // A single astral character is one character to a store and two to
    // `.length`. Counting the wrong one rejects titles that fit.
    expect('\u{1F9FE}').toHaveLength(2)
    expect(charactersIn('\u{1F9FE}')).toBe(1)
    expect(charactersIn('فاتورة')).toBe(6)
  })

  it('keeps the keyword field inside its budget in every locale', () => {
    for (const locale of LAUNCH_LOCALES) {
      const table = TERMINOLOGY_TABLES[locale]
      if (table === undefined) continue
      const listing = listingFor(table, inputFor(locale))
      expect(
        charactersIn(listing.keywordField),
        `${locale} keyword field overflowed`,
      ).toBeLessThanOrEqual(APPLE_KEYWORD_FIELD_MAX)
    }
  })
})

describe('The keyword field wastes nothing (§T: no stuffing)', () => {
  it('never repeats a word the title or subtitle already carries', () => {
    for (const locale of LAUNCH_LOCALES) {
      const table = TERMINOLOGY_TABLES[locale]
      if (table === undefined) continue
      const listing = listingFor(table, inputFor(locale))
      const indexed = new Set(wordsOf(`${listing.title} ${listing.subtitle}`))
      for (const word of listing.keywordField.split(',').filter((w) => w !== '')) {
        expect(indexed.has(word), `${locale} repeats "${word}" from its title`).toBe(false)
      }
    }
  })

  it('never repeats a word within the field', () => {
    for (const locale of LAUNCH_LOCALES) {
      const table = TERMINOLOGY_TABLES[locale]
      if (table === undefined) continue
      const words = listingFor(table, inputFor(locale)).keywordField.split(',').filter((w) => w !== '')
      expect(new Set(words).size, `${locale} repeats a keyword`).toBe(words.length)
    }
  })

  it('treats overflow as a note, never as a blocker', () => {
    // There is always more vocabulary than fits in a hundred characters. If
    // that counted as a blocker, `submittable` would be unreachable in every
    // locale forever — and an always-red signal is one nobody reads.
    // FR, whose title fits inside Apple's thirty characters, so overflow is
    // the only thing left that could hold it back.
    const listing = listingFor(approved(FR), inputFor('FR'))

    expect(listing.notes.some((n) => n.field === 'keywords')).toBe(true)
    expect(listing.blockers).toHaveLength(0)
    expect(listing.submittable).toBe(true)
  })

  it('keeps a multi-word term whole or leaves it out entirely', () => {
    // "small" without "business" recombines into nothing anybody searches and
    // spends five characters saying so.
    //
    // This needs a term that STRADDLES the boundary, or the property cannot be
    // violated and the test proves nothing — which is what an earlier version
    // of it did. Nine nine-letter fillers spend 89 of the 100 characters, so
    // ",small" (95) fits and ",business" (104) does not: word-at-a-time
    // packing would keep the first half and throw away the second.
    const fillers = ['alphaalph', 'bravobrav', 'charliech', 'deltadelt', 'echoechoe',
                     'foxtrotfo', 'golfgolfg', 'hotelhote', 'indiaindi']
    const listing = listingFor(approved(EN_NG), {
      ...inputFor('EN-NG'),
      // "offline" stays first so the subtitle is the real one; it is then
      // excluded from the field as a word the subtitle already carries.
      qualifiers: ['offline', ...fillers, 'small business'],
    })

    const present = new Set(listing.keywordField.split(','))
    expect(present.has('alphaalph')).toBe(true)
    expect(charactersIn(listing.keywordField)).toBeLessThanOrEqual(APPLE_KEYWORD_FIELD_MAX)
    // Whole or not at all — and here, given the budget, not at all.
    expect(present.has('small')).toBe(present.has('business'))
    expect(present.has('small')).toBe(false)

    // And the reviewer is told, rather than left to count characters.
    const note = listing.notes.find((n) => n.field === 'keywords')
    expect(note?.detail).toContain('small')
    expect(note?.detail).toContain('business')
  })

  it('gives Apple single words and Play whole phrases', () => {
    const listing = listingFor(EN_NG, inputFor('EN-NG'))

    // Apple recombines words itself, so a phrase there is spent budget.
    for (const word of listing.keywordField.split(',').filter((w) => w !== '')) {
      expect(word).not.toContain(' ')
    }
    // Play indexes prose, so the phrases survive for the description writer.
    expect(listing.playTerms.some((term) => term.includes(' '))).toBe(true)
  })
})

describe('The forbidden things (§T)', () => {
  it('blocks a competitor brand name wherever it appears', () => {
    const planted: LocaleListingInput = {
      ...inputFor('EN-NG'),
      qualifiers: ['offline', 'QuickBooks'],
    }
    const listing = listingFor(approved(EN_NG), planted)

    expect(listing.submittable).toBe(false)
    expect(listing.blockers.some((b) => b.reason.includes('quickbooks'))).toBe(true)
  })

  it('blocks a trim that threw away the type name', () => {
    const kept = listingFor(approved(EN_NG), {
      ...inputFor('EN-NG'),
      titleOverride: 'DocFlow: Invoice Maker',
    })
    const lost = listingFor(approved(EN_NG), {
      ...inputFor('EN-NG'),
      titleOverride: 'DocFlow: Business Paperwork',
    })

    expect(kept.blockers.filter((b) => b.field === 'title')).toHaveLength(0)
    expect(kept.submittable).toBe(true)
    expect(lost.blockers.some((b) => b.field === 'title')).toBe(true)
  })

  it('holds a reviewer’s trim to the same caps as anything generated', () => {
    const listing = listingFor(approved(EN_NG), {
      ...inputFor('EN-NG'),
      titleOverride: 'DocFlow: Invoice, Receipt and Waybill Maker for Traders',
    })

    expect(listing.blockers.some((b) => b.field === 'title')).toBe(true)
    expect(listing.submittable).toBe(false)
  })
})
