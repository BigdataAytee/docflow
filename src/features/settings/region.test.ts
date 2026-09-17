/**
 * Region & language (§D, §S, §G Settings).
 */

import { describe, expect, it } from 'vitest'

import { DOCUMENT_TYPES } from '../../domain/documents/types'
import { label as typeLabel, printedTitle } from '../../domain/locale/profile'
import { fieldsFor } from '../../domain/locale/bank-fields'
import {
  type CompanyLocaleSettings,
  RegionError,
  VALIDATED_REGIONS,
  applyLabelOverride,
  applyLanguage,
  applyRegion,
  localeProfileOf,
  regionIsComplete,
  regionProfile,
} from './region'

const settings: CompanyLocaleSettings = { region: 'NG', language: 'en', labelOverrides: {} }

describe('One country choice settles five things (§D)', () => {
  it('gives Nigeria NGN, three bank fields, VAT and a waybill', () => {
    const profile = regionProfile('NG')
    expect(profile.currency).toBe('NGN')
    expect(profile.taxLabel).toBe('VAT')
    expect(profile.locale).toBe('EN-NG')
    // §J: NGN is bank / account number / account name, no sort code.
    expect(profile.bankFieldKinds).toEqual(['bank_name', 'account_number', 'account_name'])
  })

  it('gives the UK GBP with a sort code and a delivery note', () => {
    const profile = regionProfile('GB')
    expect(profile.currency).toBe('GBP')
    expect(profile.bankFieldKinds).toContain('sort_code')
    expect(typeLabel({ locale: profile.locale }, 'waybill')).toBe('Delivery note')
  })

  it('gives the US sales tax and a packing slip on paper', () => {
    const profile = regionProfile('US')
    expect(profile.taxLabel).toBe('Sales tax')
    expect(profile.dateFormat).toBe('MM/DD/YYYY')
    expect(printedTitle({ locale: profile.locale }, 'waybill')).toBe('PACKING SLIP')
  })

  it('gives India GST rather than VAT', () => {
    expect(regionProfile('IN').taxLabel).toBe('GST')
  })

  /*
   * CHANGED DELIBERATELY. This asserted that `regionProfile('JP')` THREW —
   * "refuses a market nobody has validated, rather than guessing (§W)". The
   * refusal was real and so was the reasoning, but its cost was that a trader
   * in Japan, Kenya or Brazil could not create a business at all: the country
   * they live in was not in the dropdown, and picking it threw.
   *
   * §W's guarantee is about TERMINOLOGY, and that half is unchanged and still
   * asserted below — an unvalidated market reads international English and
   * `regionIsComplete` still says so. What it no longer does is refuse to let
   * somebody invoice.
   */
  it('serves a market nobody has validated, without claiming it is validated', () => {
    expect(() => regionProfile('JP')).not.toThrow()
    expect(regionProfile('JP').currency).toBe('JPY')
    // The §W guarantee that survives, and the one that matters: no terminology
    // table is presented as reviewed when nobody has reviewed it.
    expect(regionIsComplete('JP')).toBe(false)
  })

  it('points every VALIDATED region at a real terminology table', () => {
    // `SUPPORTED_REGIONS` is now every country, so iterating it here would be
    // asserting that all 240-odd have a signed-off table — which is the exact
    // false claim §W exists to prevent.
    for (const region of VALIDATED_REGIONS) {
      expect(regionIsComplete(region), region).toBe(true)
      expect(fieldsFor(regionProfile(region).currency).length).toBeGreaterThan(0)
    }
  })
})

describe('Changing region moves everything at once (§D, §V)', () => {
  it('changes the currency, bank fields, tax label and terminology together', () => {
    const before = regionProfile(settings.region)
    const { profile: after } = applyRegion(settings, 'GB')

    expect(after.currency).not.toBe(before.currency)
    expect(after.taxLabel).toBe(before.taxLabel) // both VAT — the exception
    expect(after.bankFieldKinds).not.toEqual(before.bankFieldKinds)
    expect(typeLabel({ locale: after.locale }, 'waybill')).not.toBe(
      typeLabel({ locale: before.locale }, 'waybill'),
    )
  })

  it('leaves the language alone — the two are independent (§S)', () => {
    // Correcting your country must not silently change what language you read.
    const { settings: moved } = applyRegion({ ...settings, language: 'en' }, 'FR')
    expect(moved.language).toBe('en')
    expect(moved.region).toBe('FR')
  })

  it('lets a French-speaking business in Lagos exist (§S)', () => {
    const nigerianFrench = applyLanguage({ ...settings, region: 'NG' }, 'en')
    expect(regionProfile(nigerianFrench.region).currency).toBe('NGN')
    expect(nigerianFrench.language).toBe('en')
  })

  it('refuses a language DocFlow cannot fully speak (§S)', () => {
    expect(() => applyLanguage(settings, 'fr')).toThrow(RegionError)
  })
})

describe('The per-type label override (§D)', () => {
  it('renames one type without touching the others', () => {
    const overridden = applyLabelOverride(settings, 'waybill', 'Dispatch docket')
    const profile = localeProfileOf(overridden)

    expect(typeLabel(profile, 'waybill')).toBe('Dispatch docket')
    for (const type of DOCUMENT_TYPES) {
      if (type !== 'waybill') {
        expect(typeLabel(profile, type)).toBe(typeLabel({ locale: 'EN-NG' }, type))
      }
    }
  })

  it('clears back to the regional name', () => {
    const set = applyLabelOverride(settings, 'waybill', 'Dispatch docket')
    const cleared = applyLabelOverride(set, 'waybill', null)
    expect(typeLabel(localeProfileOf(cleared), 'waybill')).toBe('Waybill')
  })

  it('treats blank as clearing rather than as an empty label', () => {
    const set = applyLabelOverride(settings, 'waybill', 'Dispatch docket')
    expect(typeLabel(localeProfileOf(applyLabelOverride(set, 'waybill', '   ')), 'waybill')).toBe(
      'Waybill',
    )
  })
})

/**
 * The list a person picks their country from (§D, §W).
 *
 * It had thirteen entries and threw for everything else, so signup was
 * impossible from most of the world. The narrow thing — validated terminology
 * — is still narrow; the wide thing is now wide.
 */
describe('Every country resolves to a usable profile', () => {
  it.each(['KE', 'BR', 'PH', 'PK', 'ID', 'TZ', 'UG', 'VN', 'JP', 'KW'])(
    'builds a profile for %s instead of throwing',
    (code) => {
      const profile = regionProfile(code)
      expect(profile.currency).toMatch(/^[A-Z]{3}$/)
      expect(profile.bankFieldKinds.length).toBeGreaterThan(0)
      expect(profile.taxLabel.length).toBeGreaterThan(0)
    },
  )

  it('keeps the validated markets exactly as they were', () => {
    expect(regionProfile('NG').currency).toBe('NGN')
    expect(regionProfile('NG').locale).toBe('EN-NG')
    expect(regionProfile('NG').taxLabel).toBe('VAT')
    expect(regionProfile('US').taxLabel).toBe('Sales tax')
    expect(regionProfile('CI').taxLabel).toBe('TVA')
    expect(regionProfile('IN').taxLabel).toBe('GST')
  })

  /**
   * A market with no §D vocabulary gets "Tax", never a borrowed one. Printing
   * "VAT" on an invoice in a country that calls it something else — or does
   * not levy it — is the app asserting a fact about somebody's tax affairs.
   */
  it('says "Tax" rather than borrowing another market’s word', () => {
    expect(regionProfile('KE').taxLabel).toBe('Tax')
    expect(regionProfile('BR').taxLabel).toBe('Tax')
  })

  /** Mexico defaulted to USD: a Mexican business would have invoiced in dollars. */
  it('gives Mexico pesos', () => {
    expect(regionProfile('MX').currency).toBe('MXN')
  })

  it('does not claim an unvalidated market has a signed-off table', () => {
    expect(regionIsComplete('NG')).toBe(true)
    expect(regionIsComplete('KE')).toBe(false)
  })

  /** A malformed code is a caller bug, not an unlisted market. */
  it.each(['', 'Nigeria', 'n', 'NGA'])('still refuses %s', (bad) => {
    expect(() => regionProfile(bad)).toThrow(RegionError)
  })
})
