/**
 * The country list a person actually picks from (§D, §J, §W).
 *
 * The app offered thirteen countries and `regionProfile` threw for the rest,
 * so a trader in Kenya or Brazil could not create a business — the signup
 * simply had no row for them. These assert the two things that make a longer
 * list safe rather than merely longer: every country resolves to a currency
 * with the RIGHT subdivision, and every country has a name a person recognises.
 */

import { describe, expect, it } from 'vitest'

import { ALL_COUNTRIES, COUNTRY_CURRENCY, COUNTRY_NAMES, countriesByName, countryName } from './countries'
import { currencyDefinition } from '../bank-fields'

describe('Every country is pickable, and resolves', () => {
  it('covers the countries whose absence blocked a signup', () => {
    for (const code of ['KE', 'BR', 'NG', 'GH', 'ZA', 'IN', 'PH', 'PK', 'ID', 'TZ', 'UG']) {
      expect(ALL_COUNTRIES, code).toContain(code)
    }
    // Not a token expansion: this is "most of the world", not "a few more".
    expect(ALL_COUNTRIES.length).toBeGreaterThan(200)
  })

  it('gives every country a currency and every currency a definition', () => {
    for (const code of ALL_COUNTRIES) {
      const currency = COUNTRY_CURRENCY[code]
      expect(currency, `${code} has no currency`).toMatch(/^[A-Z]{3}$/)
      const def = currencyDefinition(currency as string)
      expect(def.fields.length, `${currency} has no fields`).toBeGreaterThan(0)
    }
  })

  /**
   * The names are WRITTEN, not derived: `Intl.DisplayNames` is missing from
   * some Android System WebViews, and its absence would show a screen of
   * two-letter codes to the people least able to read them.
   */
  it('names every country in full, with no code left showing', () => {
    for (const code of ALL_COUNTRIES) {
      const name = COUNTRY_NAMES[code]
      expect(name, `${code} has no written name`).toBeDefined()
      expect(name, `${code} is still showing its code`).not.toBe(code)
      expect((name ?? '').length, `${code}'s name is too short to be one`).toBeGreaterThan(3)
    }
  })

  it('reads a code back as a name a person would recognise', () => {
    expect(countryName('NG')).toBe('Nigeria')
    expect(countryName('KE')).toBe('Kenya')
    expect(countryName('CI')).toBe('Côte d’Ivoire')
    expect(countryName('BR')).toBe('Brazil')
  })

  it('falls back to the written name rather than a code when Intl cannot help', () => {
    expect(countryName('NG', 'zz-ZZ')).not.toBe('NG')
  })

  it('sorts by name, so the list reads alphabetically to a person', () => {
    const list = countriesByName()
    const names = list.map((entry) => entry.name)
    expect(names).toEqual([...names].sort(new Intl.Collator('en').compare))
    expect(list[0]?.name.startsWith('A')).toBe(true)
  })
})

/**
 * THE MONEY ONE. Rule #3 — integer minor units, never inferred. A currency
 * whose subdivision is guessed at 100 when it is 1 stores ¥1,000 as ¥10.00.
 * That is not a display bug; the wrong number is what gets written down.
 */
describe('Minor units are right for the currencies that are not 1/100', () => {
  it.each([
    ['JPY', 1], ['KRW', 1], ['VND', 1], ['XOF', 1], ['XAF', 1], ['CLP', 1],
    ['ISK', 1], ['UGX', 1], ['RWF', 1], ['PYG', 1], ['KMF', 1], ['DJF', 1],
    ['BIF', 1], ['GNF', 1], ['VUV', 1], ['XPF', 1],
    ['KWD', 1000], ['BHD', 1000], ['OMR', 1000], ['JOD', 1000], ['TND', 1000],
    ['IQD', 1000], ['LYD', 1000],
  ])('%s has %i minor units', (code, expected) => {
    expect(currencyDefinition(code).minorUnits).toBe(expected)
  })

  it('leaves the ordinary ones at 100', () => {
    for (const code of ['NGN', 'KES', 'BRL', 'PHP', 'MXN', 'TZS', 'GHS']) {
      expect(currencyDefinition(code).minorUnits, code).toBe(100)
    }
  })

  /** Mexico defaulted to USD, so a Mexican business invoiced in dollars. */
  it('gives Mexico pesos, not dollars', () => {
    expect(COUNTRY_CURRENCY['MX']).toBe('MXN')
  })
})

describe('A market with no §J field set still gets usable fields', () => {
  it('asks for what a transfer needs anywhere, and invents no local identifier', () => {
    const kinds = currencyDefinition('PHP').fields.map((field) => field.kind)
    expect(kinds).toEqual(['bank_name', 'account_number', 'account_name', 'swift'])
    // Nothing local is fabricated for a market nobody has validated.
    expect(kinds).not.toContain('sort_code')
    expect(kinds).not.toContain('ifsc')
    expect(kinds).not.toContain('routing_number')
  })

  it('leaves the validated sets exactly as they were', () => {
    // §J is explicit for the home market: three fields, no sort code.
    expect(currencyDefinition('NGN').fields.map((f) => f.kind)).toEqual([
      'bank_name',
      'account_number',
      'account_name',
    ])
    expect(currencyDefinition('GBP').fields.map((f) => f.kind)).toContain('sort_code')
    expect(currencyDefinition('INR').fields.map((f) => f.kind)).toContain('ifsc')
  })

  /** A malformed code is a caller bug and must not be quietly absorbed. */
  it('still refuses something that is not a currency code', () => {
    expect(() => currencyDefinition('pounds')).toThrow()
    expect(() => currencyDefinition('')).toThrow()
  })
})
