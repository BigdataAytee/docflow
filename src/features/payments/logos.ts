/**
 * Provider marks, and where each one came from (§J, §F).
 *
 * A trader scanning "How you get paid" recognises a mark faster than a word,
 * so each row carries the provider's own logo beside its name. Most of this
 * file is about the conditions on doing that at all.
 *
 * ⚠ THESE ARE OTHER PEOPLE'S TRADEMARKS.
 *
 * The SVGs in `src/assets/providers` are Simple Icons glyphs (v16.32.0),
 * each filled with its owner's brand hex. The DRAWINGS are CC0; the MARKS
 * are not — CC0 covers the artwork, never the right to use somebody's
 * trademark. Identifying a service beside its name in a private settings
 * list is the narrow use this is for. Anything more public needs the
 * owner's guidelines read first, which is exactly why printed documents
 * carry names and no marks (PLAN.md).
 *
 * Every entry records the variant, the source, the owner's guidelines page
 * where one is published, and the date fetched. Guidelines change and marks
 * are redrawn; that record is what makes a re-check possible rather than
 * archaeological.
 *
 * ABSENT IS A WORKING STATE. Several providers have no free source —
 * Paystack, Flutterwave and the mobile-money operators among them — and they
 * fall back to a lettered circle of exactly the same size. A trader sees a
 * list that lines up either way, which is the point of the slot.
 *
 * BUNDLED, NEVER FETCHED (Rule #2). Each file is a module import, so the
 * bundler inlines or fingerprints it and a mark renders in airplane mode
 * like every other asset. A logo that needs the network is a logo that is
 * missing in the market this app is built for.
 *
 * WHY THIS LIVES IN `features` AND NOT `domain`. It binds files to the
 * bundler: `import x from './x.svg'` is a Vite fact, not a rule about money,
 * and `src/domain` is compiled by a Node project with no DOM and no
 * `vite/client`. The domain layer describing a trademark's PNG would be the
 * data layer reaching for a screen.
 *
 * NEVER RECOLOURED. These are single-colour glyphs in their brand's own hex,
 * and they stay that way in both themes — the slot keeps a light tile behind
 * the mark in dark mode rather than inverting it. `dark:invert` on a
 * trademark is a modified trademark.
 */

import airtel from '../../assets/providers/airtel.svg'
import cashApp from '../../assets/providers/cashapp.svg'
import monzo from '../../assets/providers/monzo.svg'
import orange from '../../assets/providers/orange.svg'
import paypal from '../../assets/providers/paypal.svg'
import paystack from '../../assets/providers/paystack.png'
import revolut from '../../assets/providers/revolut.svg'
import square from '../../assets/providers/square.svg'
import stripe from '../../assets/providers/stripe.svg'
import venmo from '../../assets/providers/venmo.svg'
import wise from '../../assets/providers/wise.svg'

import type { ProviderId } from '../../domain/payments/providers'

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
  /** Where the file came from, so the next person can check it again. */
  readonly source: string
  /** The owner's own guidelines, where they publish them. */
  readonly guidelines?: string
  /** When it was fetched. Guidelines change; this is what makes that checkable. */
  readonly fetched: string
}

/** Every mark was taken on this date. Re-check at each market launch. */
export const LOGOS_FETCHED = '2026-09-21'

const simpleIcons = (owner: string) =>
  `simple-icons@16.32.0 (CC0 artwork; the mark remains ${owner}'s trademark)`

/**
 * The marks that are bundled.
 *
 * Eleven of the eighteen. Flutterwave, MTN MoMo, M-Pesa, Wave, OPay and
 * PalmPay have no bundled file yet and keep the lettered fallback,
 * which is the documented working state rather than a gap — drop a file in
 * `src/assets/providers`, import it, record its provenance, and the row picks
 * it up with nothing else changing.
 */
export const PROVIDER_LOGOS: Partial<Record<ProviderId, ProviderLogo>> = {
  paystack_page: {
    light: paystack,
    /*
     * PAYSTACK'S OWN MARK, not a simple-icons glyph — the only entry here
     * taken from the provider's own brand asset rather than redrawn.
     */
    variant: 'Paystack mark, full colour',
    source: "Paystack's own brand asset (PaystackHQ/website-v1, images/brand/logo/mark.png)",
    guidelines: 'https://paystack.frontify.com/d/5HvMw0IF9blo/paystack-media-kit',
    fetched: LOGOS_FETCHED,
  },
  paypal_me: {
    light: paypal,
    variant: 'PayPal monogram, brand blue',
    source: simpleIcons('PayPal'),
    guidelines: 'https://newsroom.paypal-corp.com/media-resources',
    fetched: LOGOS_FETCHED,
  },
  wise: {
    light: wise,
    variant: 'Wise glyph, brand green',
    source: simpleIcons('Wise'),
    guidelines: 'https://wise.design/foundations/logo',
    fetched: LOGOS_FETCHED,
  },
  revolut: {
    light: revolut,
    variant: 'Revolut glyph, brand near-black',
    source: simpleIcons('Revolut'),
    guidelines:
      'https://developer.revolut.com/docs/resources/marketing-assets-guidelines/marketing-guidelines',
    fetched: LOGOS_FETCHED,
  },
  monzo_me: {
    light: monzo,
    variant: 'Monzo glyph, brand navy',
    source: simpleIcons('Monzo'),
    guidelines: 'https://monzo.com/press/',
    fetched: LOGOS_FETCHED,
  },
  cash_app: {
    light: cashApp,
    variant: 'Cash App glyph, brand green',
    source: simpleIcons('Block, Inc.'),
    guidelines: 'https://cash.app/press',
    fetched: LOGOS_FETCHED,
  },
  venmo: {
    light: venmo,
    variant: 'Venmo glyph, brand blue',
    source: simpleIcons('PayPal'),
    guidelines: 'https://venmo.com/about/brand',
    fetched: LOGOS_FETCHED,
  },
  stripe_link: {
    light: stripe,
    variant: 'Stripe glyph, brand indigo',
    source: simpleIcons('Stripe'),
    guidelines: 'https://stripe.com/newsroom/information',
    fetched: LOGOS_FETCHED,
  },
  airtel_money: {
    light: airtel,
    variant: 'Airtel glyph, brand red',
    source: simpleIcons('Airtel'),
    guidelines: 'https://www.airtel.in/logo-tune',
    fetched: LOGOS_FETCHED,
  },
  orange_money: {
    light: orange,
    variant: 'Orange glyph, brand orange',
    source: simpleIcons('Orange'),
    guidelines: 'https://system.design.orange.com/0c1af118d/p/494474-guidelines',
    fetched: LOGOS_FETCHED,
  },
  square_link: {
    light: square,
    variant: 'Square glyph, brand grey',
    source: simpleIcons('Block, Inc.'),
    guidelines: 'https://squareup.com',
    fetched: LOGOS_FETCHED,
  },
}

/**
 * The mark to draw for this provider in this theme, or null.
 *
 * Null is not a failure: it is the documented state for a provider whose mark
 * has no free source, or whose guidelines do not permit this use. The row
 * shows a lettered circle of the same size, and the name — which was always
 * the thing that had to be readable.
 *
 * `other_link` never has one by definition: it is not a provider, it is the
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
 * SPLIT OUT SO IT CAN BE TESTED WITHOUT A BUNDLE. This rule was once asserted
 * only through a test that mocked the whole module, so it checked the mock's
 * copy of the rule: breaking the real one left it green. Two literals prove
 * it now.
 *
 * The dark variant only when the provider SUPPLIES one. None of the current
 * eight does — they are single-colour brand glyphs — so all eight keep their
 * own colour on both themes, sitting on a light tile. Inverting one is not
 * something this app gets to decide.
 */
export const variantFor = (logo: ProviderLogo, scheme: 'light' | 'dark'): string =>
  scheme === 'dark' ? (logo.dark ?? logo.light) : logo.light

/** Every provider whose mark is bundled, for the guards and for the record. */
export const PROVIDERS_WITH_LOGOS = Object.keys(PROVIDER_LOGOS) as readonly ProviderId[]
