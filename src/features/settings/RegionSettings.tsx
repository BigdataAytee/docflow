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

import { useMemo } from 'react'

import { useCompany } from '../../app/context'
import { Icon } from '../../ui'
import { availableLanguages } from '../../domain/locale/data/strings'
import { DOCUMENT_TYPES } from '../../domain/documents/types'
import { label as typeLabel } from '../../domain/locale/profile'
import { fieldsFor } from '../../domain/locale/bank-fields'
import { countriesByName } from '../../domain/locale/data/countries'
import {
  type CompanyLocaleSettings,
  localeProfileOf,
  regionProfile,
} from './region'

export interface RegionSettingsProps {
  readonly settings: CompanyLocaleSettings
  readonly onRegion: (region: string) => void
  /** §D.4: the language is chosen independently of the region. */
  readonly onLanguage: (language: string) => void
}

export function RegionSettings({ settings, onRegion, onLanguage }: RegionSettingsProps) {
  const { strings } = useCompany()
  const profile = regionProfile(settings.region)
  const localeProfile = localeProfileOf(settings)
  const languages = availableLanguages()
  // Built once: 240-odd names through a collator is not work to repeat on
  // every keystroke elsewhere on the screen.
  const countries = useMemo(() => countriesByName(), [])

  return (
    <section className="space-y-4 px-4 py-4">
      <h1 className="text-lg font-bold">{strings.settings.regionAndLanguage}</h1>

      <label className="glass-solid block rounded-2xl p-4">
        <span className="mb-1 block text-xs font-medium opacity-70">
          {strings.settings.businessCountry}
        </span>
        <select
          value={settings.region}
          onChange={(event) => onRegion(event.target.value)}
          aria-label={strings.settings.businessCountry}
          className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
        >
          {/*
            The NAME, not the code. This listed two-letter codes — "NG", "CI"
            — which is the app's internal identifier shown to a person as
            though it were a country. `NewBusinessScreen` was fixed for this
            and this one was missed, which is what a second copy of a list
            always costs. Both now read the same source, sorted by name.
          */}
          {countries.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <span className="mt-2 block text-xs opacity-60">{strings.settings.countryHint}</span>
      </label>

      {/* The consequences, beside the cause. */}
      <dl className="glass-solid space-y-2 rounded-2xl p-4 text-sm">
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
          <dd className="text-end font-semibold">
            {fieldsFor(profile.currency).map((field) => field.label).join(' · ')}
          </dd>
        </div>
      </dl>

      {/*
        APP LANGUAGE (§G, §S, §D.4).
        §G puts it on this screen — "business country ...; app language;
        per-type label override" — and the string for it has been in the
        catalogue since the screen was written with nothing rendering it.
        `Company.localeLanguage` drove the whole string catalogue from
        `App.tsx` and NO screen could set it: four language slots in the
        design, and the app fixed to one.

        The list is whatever has a complete catalogue, derived rather than
        written down, because §S's "no non-working language toggle ever ships"
        is broken precisely by a hand-kept list. Today that is English alone,
        and the screen says so rather than pretending to offer a choice.
      */}
      <section className="glass-solid rounded-2xl p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide opacity-60">
          {strings.settings.appLanguage}
        </h2>
        <ul className="mt-2 divide-y divide-ink/10">
          {languages.map((language) => (
            <li key={language.code}>
              <button
                type="button"
                aria-pressed={language.code === settings.language}
                onClick={() => onLanguage(language.code)}
                className="flex min-h-tap w-full items-center gap-3 py-2 text-start"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-tint text-[11px] font-bold uppercase text-brand"
                >
                  {language.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {language.name}
                </span>
                {language.code === settings.language && (
                  <span aria-hidden="true" className="shrink-0 text-status-good">
                    <Icon name="check" size={0.9} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {languages.length === 1 && (
          <p className="mt-1 text-xs leading-relaxed opacity-60">
            {strings.settings.oneLanguageOnly}
          </p>
        )}
      </section>

      {/*
        WHAT THE DOCUMENTS ARE CALLED — shown, not asked.

        This was four text boxes, one per type, for the owner to type their own
        word into. Removed at their instruction: "it should be an automatic
        thing the app is able to decide by itself." It always could — the
        country picks the terminology table, and the table has the word. Asking
        somebody to type "Waybill" into a box labelled Waybill was the app
        handing back the one job it was supposed to do.

        It is still SHOWN, because §N says a thing the app decided is said
        rather than left to be discovered on a finished PDF — and because it is
        the clearest possible demonstration of what the country above actually
        does. Change the country and these four words change with it.
      */}
      <section className="glass-solid space-y-2 rounded-2xl p-4" data-document-names>
        <h2 className="text-xs font-bold uppercase tracking-wide opacity-60">
          {strings.settings.documentsAreCalled}
        </h2>
        {/*
          The four words and nothing else.

          The first draft put the locale code beside each one — EN-NG, four
          times, identical down the column. It repeated itself, it named an
          internal identifier at somebody who has never seen one, and the line
          underneath already says where the words come from.
        */}
        <ul className="flex flex-wrap gap-x-2 gap-y-1">
          {DOCUMENT_TYPES.map((type, index) => (
            <li key={type} className="flex items-baseline gap-2 text-sm font-semibold">
              {index > 0 && (
                <span aria-hidden="true" className="opacity-30">
                  ·
                </span>
              )}
              <span>{typeLabel(localeProfile, type)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed opacity-60">
          {strings.settings.namesFollowCountry}
        </p>
      </section>

      <p className="text-xs opacity-60">{strings.settings.effectiveImmediately}</p>
    </section>
  )
}
