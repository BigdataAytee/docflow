/**
 * Provider marks, and where each one came from (§J, §F).
 *
 * A trader scanning "How you get paid" recognises a mark faster than a word,
 * so the Settings list shows each provider's own logo beside its name. That
 * is the whole feature, and almost all of this file is about the conditions
 * on doing it at all.
 *
 * ⚠ NOTHING HERE MAY BE DRAWN BY US.
 *
 * Every mark below is a registered trademark belonging to somebody else, and
 * a mark used outside its owner's guidelines is this app's problem, not the
 * trader's. So an entry is only ever a POINTER to a file taken from the
 * provider's own brand or press page, with the variant, the source and the
 * date it was fetched recorded beside it. An approximation drawn to look
 * close enough is not a cheaper version of that — it is the thing trademark
 * guidelines exist to stop.
 *
 * ABSENT IS A WORKING STATE. `logoFor` returns null for a provider with no
 * bundled file, the row falls back to its name alone, and nothing looks
 * broken. That is what lets this ship before anybody has visited ten brand
 * pages, and what keeps a provider whose guidelines turn out to forbid this
 * from being a gap in the interface.
 *
 * BUNDLED, NEVER FETCHED (Rule #2). The files live in `src/assets/providers`
 * and are imported so the bundler inlines or fingerprints them; nothing here
 * is ever a URL to somebody's CDN. A logo that needs the network is a logo
 * that is missing in the market this app is built for.
 *
 * NEVER RECOLOURED. Where a provider supplies a light and a dark variant,
 * both are recorded and the right one is chosen. Where they supply only one,
 * that one is used in both themes — an inverted or filtered mark is a
 * modified mark, and every set of guidelines says not to.
 *
 * ON PRINTED DOCUMENTS: names only, no marks. See PLAN.md — that is a
 * decision pending a per-provider guidelines review, not an oversight.
 */

import type { ProviderId } from './providers'

export interface ProviderLogo {
  /**
   * The bundled asset, already resolved by the bundler.
   *
   * A module import, never a string path and never a URL: an import is what
   * makes the file part of the app, and a missing one is a build error rather
   * than a broken image on somebody's phone.
   */
  readonly light: string
  /** The variant for a dark background, where the provider supplies one. */
  readonly dark?: string
  /** Which variant of the mark this is, in the provider's own words. */
  readonly variant: string
  /** The page it was taken from, so the next person can check it again. */
  readonly source: string
  /** When it was fetched. Guidelines change; this is what makes that checkable. */
  readonly fetched: string
}

/**
 * The marks that have been fetched, checked and bundled.
 *
 * EMPTY UNTIL SOMEBODY VISITS THE BRAND PAGES. Each entry needs a real file
 * downloaded from the provider's own site — which cannot be done from here,
 * and must not be faked. Adding one is: drop the file in
 * `src/assets/providers/`, import it, and fill in the four fields above.
 *
 * Every provider absent from this map renders its name alone, which is
 * exactly what `logoFor` returning null is for.
 */
export const PROVIDER_LOGOS: Partial<Record<ProviderId, ProviderLogo>> = {
  /*
   * Example of a filled entry, for whoever adds the first one:
   *
   *   paypal_me: {
   *     light: paypalMark,            // import paypalMark from '../../assets/providers/paypal.svg'
   *     variant: 'PayPal monogram, full colour',
   *     source: 'https://newsroom.paypal-corp.com/media-resources',
   *     fetched: '2026-09-21',
   *   },
   */
}

/**
 * The mark to draw for this provider in this theme, or null.
 *
 * Null is not a failure: it is the documented state for a provider whose mark
 * has not been fetched, or whose guidelines do not permit this use. The row
 * shows its name, which was always the thing that had to be readable.
 *
 * `other_link` never has one by definition — it is not a provider, it is the
 * escape hatch for an address nobody here has heard of.
 */
export function logoFor(provider: ProviderId, scheme: 'light' | 'dark'): string | null {
  if (provider === 'other_link') return null
  const logo = PROVIDER_LOGOS[provider]
  if (logo === undefined) return null
  return variantFor(logo, scheme)
}

/**
 * Which file to draw, given a mark and a theme.
 *
 * SPLIT OUT SO IT CAN BE TESTED WITHOUT A BUNDLE. The map is empty until
 * somebody visits ten brand pages, so every test of `logoFor` has to supply
 * its own entries — and a test that mocks the module ends up asserting the
 * mock. This is the rule itself, checkable against two literals.
 *
 * The dark variant only when the provider SUPPLIES one. Falling back to the
 * light mark on a dark background is what its guidelines contemplate;
 * inverting it is not something this app gets to decide.
 */
export const variantFor = (logo: ProviderLogo, scheme: 'light' | 'dark'): string =>
  scheme === 'dark' ? (logo.dark ?? logo.light) : logo.light

/** Every provider whose mark is bundled, for the guards and for the record. */
export const PROVIDERS_WITH_LOGOS = Object.keys(PROVIDER_LOGOS) as readonly ProviderId[]
