/**
 * Region & language (§D, §G Settings).
 *
 * "Business country → terminology, currency default, bank fields, tax label,
 * date format; app language; per-type label override for edge cases — all
 * effective immediately, offline, everywhere at once."
 *
 * One choice drives five things, which is the whole point: §D calls choosing a
 * country "one picker, pre-filled — not a new required field", so everything
 * downstream has to follow from it rather than being asked separately.
 *
 * Region and language stay INDEPENDENT (§S): a French-speaking business in
 * Lagos gets FR strings with NGN banking and its chosen terminology.
 */

import type { DocumentType } from '../../domain/documents/types'
import type { LocaleId } from '../../domain/locale/types'
import { TERMINOLOGY_TABLES } from '../../domain/locale/data/terminology'
import { REGION_DEFAULT_CURRENCY } from '../../domain/locale/data/currencies'
import { fieldsFor } from '../../domain/locale/bank-fields'
import { hasStringsFor } from '../../domain/locale/data/strings'

export class RegionError extends Error {}

/** What a single country choice settles (§D). */
export interface RegionProfile {
  readonly region: string
  readonly locale: LocaleId
  readonly currency: string
  readonly bankFieldKinds: readonly string[]
  /** VAT / GST / Sales tax / TVA — the label only. Rates stay user-set (§D). */
  readonly taxLabel: string
  readonly dateFormat: string
}

/** Which terminology table a country reads. Explicit, never guessed. */
const LOCALE_FOR_REGION: Readonly<Record<string, LocaleId>> = {
  NG: 'EN-NG', GH: 'EN-GH',
  GB: 'EN-GB', IE: 'EN-GB', ZA: 'EN-GB', IN: 'EN-GB',
  US: 'EN-US', CA: 'EN-US',
  FR: 'FR', CI: 'FR',
  ES: 'ES', MX: 'ES',
  AE: 'AR', EG: 'AR',
}

/** §D: "tax vocabulary (VAT / GST / Sales tax / TVA — label only)". */
const TAX_LABEL_FOR_REGION: Readonly<Record<string, string>> = {
  NG: 'VAT', GH: 'VAT', GB: 'VAT', IE: 'VAT', ZA: 'VAT', AE: 'VAT', EG: 'VAT',
  US: 'Sales tax', CA: 'Sales tax',
  FR: 'TVA', CI: 'TVA',
  ES: 'IVA', MX: 'IVA',
  IN: 'GST',
}

const DATE_FORMAT_FOR_REGION: Readonly<Record<string, string>> = {
  US: 'MM/DD/YYYY',
}

export const SUPPORTED_REGIONS: readonly string[] = Object.keys(LOCALE_FOR_REGION)

export function regionProfile(region: string): RegionProfile {
  const locale = LOCALE_FOR_REGION[region]
  const currency = REGION_DEFAULT_CURRENCY[region]
  const taxLabel = TAX_LABEL_FOR_REGION[region]

  if (locale === undefined || currency === undefined || taxLabel === undefined) {
    // A market nobody has validated gets an error, not a guess — §W holds the
    // field sets and tax vocabulary open for per-market review.
    throw new RegionError(
      `No profile for region "${region}". Adding a market means validating its terminology, currency and tax vocabulary first (v6 §W).`,
    )
  }

  return {
    region,
    locale,
    currency,
    bankFieldKinds: fieldsFor(currency).map((field) => field.kind),
    taxLabel,
    dateFormat: DATE_FORMAT_FOR_REGION[region] ?? 'DD/MM/YYYY',
  }
}

export interface CompanyLocaleSettings {
  readonly region: string
  readonly language: string
  readonly labelOverrides: Partial<Record<DocumentType, string>>
}

/**
 * Applying a region change. Returns the whole new settings object rather than
 * patching in place, so a caller cannot update the terminology and forget the
 * currency — §D requires all of it to move together.
 *
 * Language is NOT changed: §S makes it an independent choice, and silently
 * switching someone's language because they corrected their country would be
 * the opposite of Rule #1.
 */
export function applyRegion(
  current: CompanyLocaleSettings,
  region: string,
): { settings: CompanyLocaleSettings; profile: RegionProfile } {
  const profile = regionProfile(region)
  return {
    settings: { ...current, region },
    profile,
  }
}

export function applyLanguage(
  current: CompanyLocaleSettings,
  language: string,
): CompanyLocaleSettings {
  if (!hasStringsFor(language)) {
    // §S: no non-working language toggle ever ships.
    throw new RegionError(
      `DocFlow does not speak "${language}" yet. Offering a language it cannot fully speak is worse than not offering it (v6 §S).`,
    )
  }
  return { ...current, language }
}

/** The per-type override §D allows for the rare edge case. */
export function applyLabelOverride(
  current: CompanyLocaleSettings,
  type: DocumentType,
  label: string | null,
): CompanyLocaleSettings {
  const overrides = { ...current.labelOverrides }
  if (label === null || label.trim() === '') {
    delete overrides[type]
  } else {
    overrides[type] = label.trim()
  }
  return { ...current, labelOverrides: overrides }
}

/** The locale profile the rest of the app reads, from these settings. */
export function localeProfileOf(settings: CompanyLocaleSettings) {
  const profile = regionProfile(settings.region)
  return { locale: profile.locale, labelOverrides: settings.labelOverrides }
}

/** Every region points at a terminology table that actually exists. */
export const regionIsComplete = (region: string): boolean => {
  try {
    return TERMINOLOGY_TABLES[regionProfile(region).locale] !== undefined
  } catch {
    return false
  }
}
