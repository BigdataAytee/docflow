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

import type { LocaleId } from '../../domain/locale/types'
import { TERMINOLOGY_TABLES } from '../../domain/locale/data/terminology'
import { REGION_DEFAULT_CURRENCY } from '../../domain/locale/data/currencies'
import { fieldsFor } from '../../domain/locale/bank-fields'
import { ALL_COUNTRIES, COUNTRY_CURRENCY } from '../../domain/locale/data/countries'
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

/**
 * Every country, not just the validated ones.
 *
 * This used to be `Object.keys(LOCALE_FOR_REGION)` — thirteen entries — and
 * `regionProfile` threw for anything outside it. The rule behind that is
 * sound and is kept below: a market whose TERMINOLOGY nobody has signed off
 * does not get an invented terminology table. But it was applied to the whole
 * profile, so a trader in Kenya or Brazil could not create a business, and
 * the product's answer to most of the world was a dropdown that did not list
 * them.
 */
export const SUPPORTED_REGIONS: readonly string[] = ALL_COUNTRIES

/** The markets whose terminology, tax vocabulary and fields are validated. */
export const VALIDATED_REGIONS: readonly string[] = Object.keys(LOCALE_FOR_REGION)

/**
 * The terminology table an unvalidated market reads.
 *
 * International English, which is what §D's intl table is for. NOT a guess at
 * the local vocabulary: `regionIsComplete` still reports which markets have a
 * signed-off table, and nothing here marks one as reviewed that is not.
 */
const FALLBACK_LOCALE: LocaleId = 'EN-GB'

/**
 * The tax label where §D has no vocabulary for the market.
 *
 * Plain "Tax" on purpose. §D lists VAT / GST / Sales tax / TVA as LABELS, and
 * printing "VAT" on an invoice in a country that calls it something else, or
 * does not levy it, is the app asserting a fact about somebody's tax affairs.
 * "Tax" is true everywhere and is overridable in Settings; the rate was always
 * user-set (§D).
 */
const FALLBACK_TAX_LABEL = 'Tax'

export function regionProfile(region: string): RegionProfile {
  const code = region.trim().toUpperCase()

  // A malformed code is a caller bug and must not be absorbed into a default.
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new RegionError(
      `"${region}" is not an ISO 3166-1 country code. An unlisted market falls back; a malformed code is a bug.`,
    )
  }

  const locale = LOCALE_FOR_REGION[code] ?? FALLBACK_LOCALE
  const currency = REGION_DEFAULT_CURRENCY[code] ?? COUNTRY_CURRENCY[code] ?? 'USD'
  const taxLabel = TAX_LABEL_FOR_REGION[code] ?? FALLBACK_TAX_LABEL
  region = code

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

/** The locale profile the rest of the app reads, from these settings. */
export function localeProfileOf(settings: CompanyLocaleSettings) {
  return { locale: regionProfile(settings.region).locale }
}

/** Every region points at a terminology table that actually exists. */
/**
 * Whether this market has terminology signed off FOR IT (§W, CLAUDE.md).
 *
 * Reads the explicit mapping, never `regionProfile`. Once an unlisted country
 * falls back to international English, `regionProfile(region).locale` always
 * names a table that exists — so routing this through the profile would have
 * answered "complete" for every country on earth, and the one guarantee this
 * function carries is that a terminology table nobody reviewed is not shipped
 * as though somebody had.
 *
 * "Renders correctly" and "was reviewed by a native speaker of this market"
 * are different claims. This is the second one.
 */
export const regionIsComplete = (region: string): boolean => {
  const locale = LOCALE_FOR_REGION[region.trim().toUpperCase()]
  return locale !== undefined && TERMINOLOGY_TABLES[locale] !== undefined
}
