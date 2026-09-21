/**
 * The first business (§R).
 *
 * §R: "company name, **business country** (pre-filled from the phone; sets
 * terminology, currency default, bank fields, tax label, date format in one
 * confirmation — replacing the bare currency default, adding no new required
 * field)."
 *
 * So there are exactly two controls, and the second one is why: a country
 * chosen once settles five things that would otherwise each be a question.
 * Rule #1 — no new required fields, ever — means nothing else may appear here;
 * logo, address, payment details and signature all belong to "Do this later".
 */

import { useId, useMemo, useState } from 'react'

import type { UiStrings } from '../../domain/locale/data/strings'
import { SUPPORTED_REGIONS, regionProfile } from '../settings/region'
import { detectRegion, readSignals } from '../../domain/locale/detect'
import { countriesByName } from '../../domain/locale/data/countries'

export interface NewBusinessScreenProps {
  readonly strings: UiStrings
  /** Pre-filled from the device, per §R. */
  readonly suggestedRegion?: string
  readonly onCreate: (input: { name: string; region: string; currency: string }) => Promise<void>
  readonly onSignOut?: () => Promise<void>
}

/**
 * The device's country. A GUESS at a default, never a decision: it lands in a
 * control the owner can see and change before anything is created.
 *
 * It used to read the country out of `navigator.language` alone, which is a
 * LANGUAGE tag and not a location — a Nigerian phone in English says `en-US`,
 * so this offered the United States and the business's delivery documents
 * came out called "Packing slip". `detectRegion` reads the time zone first,
 * which is the one signal that describes a place, and falls back to the
 * language tag only when it carries a real country subtag.
 */
export function regionFromBrowser(): string | undefined {
  return detectRegion(readSignals(), (region) => SUPPORTED_REGIONS.includes(region)).region
}

export function NewBusinessScreen({
  strings,
  suggestedRegion,
  onCreate,
  onSignOut,
}: NewBusinessScreenProps) {
  const a = strings.account
  const ids = useId()

  const [name, setName] = useState('')
  const [region, setRegion] = useState(suggestedRegion ?? 'NG')
  // Built once: 240-odd names through a collator is not work to repeat on
  // every keystroke in the name field above it.
  const countries = useMemo(() => countriesByName(), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profile = regionProfile(region)
  const canCreate = name.trim() !== '' && !busy

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-xl font-bold">{a.businessTitle}</h1>
      <p className="mt-2 text-sm opacity-70">{a.businessBody}</p>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canCreate) return
          setBusy(true)
          setError(null)
          void onCreate({ name: name.trim(), region, currency: profile.currency })
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : String(cause)),
            )
            .finally(() => setBusy(false))
        }}
      >
        <label className="block text-xs font-medium opacity-70" htmlFor={`${ids}-name`}>
          {a.businessName}
        </label>
        <input
          id={`${ids}-name`}
          className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-region`}>
          {a.businessCountry}
        </label>
        <select
          id={`${ids}-region`}
          className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
        >
          {/*
            The NAME, not the code. This listed thirteen two-letter codes —
            "NG", "CI" — which is the app's internal identifier shown to a
            person as though it were a country. Someone who does not already
            know that CI is Côte d'Ivoire has no way to find it, and someone
            in Kenya could not find their country at all because it was not
            there. Sorted by name so the list reads alphabetically to a
            reader rather than to a database.
          */}
          {countries.map(({ code, name: label }) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        {/*
          What the country actually settled, shown before it is confirmed —
          §R's "one confirmation". Currency and tax label are named because
          they are the two the owner will notice first if they are wrong.
        */}
        <p className="mt-1 text-[11px] opacity-70">
          {profile.currency} · {profile.taxLabel} · {profile.dateFormat}
        </p>

        <button
          type="submit"
          disabled={!canCreate}
          className="raised tap-scale mt-5 min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white disabled:opacity-70"
        >
          {busy ? a.creating : a.createBusiness}
        </button>
      </form>

      {onSignOut !== undefined && (
        <button
          type="button"
          className="mt-4 min-h-tap text-xs font-medium underline opacity-70"
          onClick={() => void onSignOut()}
        >
          {a.signOut}
        </button>
      )}

      {error !== null && (
        <p
          className="mt-3 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {error}
        </p>
      )}
    </main>
  )
}
