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
  SUPPORTED_REGIONS,
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

  it('refuses a market nobody has validated, rather than guessing (§W)', () => {
    expect(() => regionProfile('JP')).toThrow(RegionError)
    expect(regionIsComplete('JP')).toBe(false)
  })

  it('points every supported region at a real terminology table', () => {
    for (const region of SUPPORTED_REGIONS) {
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
