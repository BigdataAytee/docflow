/**
 * Settings → Region & language (§G, §D).
 *
 * "Business country → terminology, currency default, bank fields, tax label,
 * date format; app language; per-type label override for edge cases — all
 * effective immediately, offline, everywhere at once."
 *
 * The screen shows the consequences of the country next to the picker, so the
 * one choice §D asks for is visibly the one choice — not a setting whose
 * effects the user discovers later somewhere else.
 */

import { useCompany } from '../../app/context'
import { DOCUMENT_TYPES } from '../../domain/documents/types'
import { label as typeLabel } from '../../domain/locale/profile'
import { fieldsFor } from '../../domain/locale/bank-fields'
import {
  type CompanyLocaleSettings,
  SUPPORTED_REGIONS,
  localeProfileOf,
  regionProfile,
} from './region'

export interface RegionSettingsProps {
  readonly settings: CompanyLocaleSettings
  readonly onRegion: (region: string) => void
  readonly onOverride: (type: (typeof DOCUMENT_TYPES)[number], label: string | null) => void
}

export function RegionSettings({ settings, onRegion, onOverride }: RegionSettingsProps) {
  const { strings } = useCompany()
  const profile = regionProfile(settings.region)
  const localeProfile = localeProfileOf(settings)

  return (
    <section className="space-y-4 px-4 py-4">
      <h1 className="text-lg font-bold">{strings.settings.regionAndLanguage}</h1>

      <label className="block rounded-2xl bg-white/85 p-4">
        <span className="mb-1 block text-xs font-medium opacity-70">
          {strings.settings.businessCountry}
        </span>
        <select
          value={settings.region}
          onChange={(event) => onRegion(event.target.value)}
          aria-label={strings.settings.businessCountry}
          className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
        >
          {SUPPORTED_REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
        <span className="mt-2 block text-xs opacity-60">{strings.settings.countryHint}</span>
      </label>

      {/* The consequences, beside the cause. */}
      <dl className="space-y-2 rounded-2xl bg-white/85 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="opacity-70">{strings.settings.currencyIs}</dt>
          <dd className="font-semibold">{profile.currency}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="opacity-70">{strings.settings.taxIsCalled}</dt>
          <dd className="font-semibold">{profile.taxLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="opacity-70">{strings.settings.bankFieldsAre}</dt>
          <dd className="text-right font-semibold">
            {fieldsFor(profile.currency).map((field) => field.label).join(' · ')}
          </dd>
        </div>
      </dl>

      <section className="space-y-3 rounded-2xl bg-white/85 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide opacity-60">
          {strings.settings.callThisDocument}
        </h2>
        {DOCUMENT_TYPES.map((type) => (
          <label key={type} className="block">
            <span className="mb-1 block text-xs opacity-70">{typeLabel(localeProfile, type)}</span>
            <input
              value={settings.labelOverrides[type] ?? ''}
              placeholder={typeLabel({ locale: profile.locale }, type)}
              onChange={(event) =>
                onOverride(type, event.target.value === '' ? null : event.target.value)
              }
              aria-label={typeLabel(localeProfile, type)}
              className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
            />
          </label>
        ))}
      </section>

      <p className="text-xs opacity-60">{strings.settings.effectiveImmediately}</p>
    </section>
  )
}
