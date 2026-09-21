/**
 * The payment links a trader can paste, and where each one works (§J).
 *
 * §J declares bank fields once per currency and has the settings form and the
 * printed box both read that declaration, "so they cannot drift and no field
 * can be invented for a country that lacks it". This is the same machinery
 * for the other half of §J's list — the provider links — and it exists for
 * the same reason: a placeholder in a form and a line on an invoice that
 * disagree are two descriptions of one account.
 *
 * NOTHING HERE IS CONFIGURED INSIDE DOCFLOW. Every one of these is a link the
 * trader already has, copied from another app on the same phone. No dashboard,
 * no OAuth, no keys, no provider integration — a `paypal.me/ade` is a string,
 * and printing it on an invoice is the whole feature. That is what keeps it
 * inside Rule #2: it works in airplane mode because there is nothing to call.
 *
 * ⚠ MARKETS ARE DECLARED, NOT VERIFIED.
 *
 * `markets` on each provider says where that provider is believed to be able
 * to RECEIVE money, which is a business fact that changes without notice and
 * that nobody here can check. Every list carries `reviewedOn`, the whole table
 * is `reviewStatus: 'draft'`, and §J's standing instruction applies word for
 * word: "validate each launch market". Re-check before every market launch.
 *
 * AND DETECTION IS NEVER A LOCK. Choosing the wrong country must not trap
 * anybody, so `providersFor` returns BOTH halves — what to offer, and
 * everything else — and the screen puts the second behind one quiet line.
 * The country list that shipped with thirteen entries is the lesson: an
 * automatic choice is a default, never a gate.
 */

export type ProviderId =
  | 'paypal_me'
  | 'wise'
  | 'revolut'
  | 'monzo_me'
  | 'cash_app'
  | 'venmo'
  | 'stripe_link'
  | 'paystack_page'
  | 'flutterwave_page'
  | 'square_link'
  | 'other_link'

export interface PaymentProvider {
  readonly id: ProviderId
  /** What a customer sees printed above the link (§I, §D). */
  readonly name: string
  /**
   * The host and path a link of this kind has, minus the handle.
   *
   * One string doing three jobs: the placeholder a person sees, the prefix a
   * bare handle is completed with, and the shape a pasted URL is checked
   * against. Three copies would be three chances to disagree.
   */
  readonly prefix: string
  /** The example, with the handle filled in — `paypal.me/yourname`. */
  readonly sample: string
  /**
   * One line under the name, where it earns its place (§G).
   *
   * Not a description of the company — a trader knows what PayPal is. What
   * they may not know is what this ROW will ask them for, which is the one
   * thing worth six words before they tap it.
   */
  readonly blurb: string
  /**
   * True when a bare handle alone is enough — "ade" becoming
   * `paypal.me/ade`. False for the ones whose codes are opaque: a Stripe
   * payment link is `buy.stripe.com/aEU5kC1x2`, and accepting "aEU5kC1x2"
   * on its own would be accepting anything at all.
   */
  readonly acceptsBareHandle: boolean
  /**
   * Where to find the link, for the providers that hide it (§G, §N).
   *
   * One sentence, in the app, beside the field. Never a help article and
   * never a link out — the trader is offline half the time, which is the
   * whole premise.
   */
  readonly findIt?: string
  /**
   * Where this is believed to be able to RECEIVE money. Declared, not
   * verified — see the warning above.
   */
  readonly markets: readonly string[]
}

/** When these market lists were written down. Not when they were checked. */
export const PROVIDERS_REVIEWED_ON = '2026-09-20'

/** Nothing here has been confirmed with a provider. §J's rule, applied. */
export const PROVIDERS_REVIEW_STATUS = 'draft' as const

/**
 * The providers §J's list and the owner's own list name, and nothing else.
 *
 * `markets` is deliberately SHORT. A list that claims forty countries is a
 * list nobody can check; a list that claims the handful anybody has actually
 * named is one a native of each can confirm in a sentence. Everything absent
 * from a market is still reachable — that is what `others` is for — so the
 * cost of a short list is one extra tap, and the cost of a long wrong one is
 * a trader printing a link that cannot take their money.
 */
export const PROVIDERS: Readonly<Record<ProviderId, PaymentProvider>> = {
  paystack_page: {
    id: 'paystack_page',
    name: 'Paystack',
    prefix: 'paystack.com/pay/',
    sample: 'paystack.com/pay/your-page',
    blurb: 'Paste your Paystack page link',
    acceptsBareHandle: true,
    findIt: 'Paystack Dashboard → Payment Pages → your page → Copy link.',
    markets: ['NG', 'GH', 'ZA', 'KE'],
  },
  flutterwave_page: {
    id: 'flutterwave_page',
    name: 'Flutterwave',
    prefix: 'flutterwave.com/pay/',
    sample: 'flutterwave.com/pay/your-page',
    blurb: 'Paste your Flutterwave link',
    acceptsBareHandle: true,
    findIt: 'Flutterwave Dashboard → Payment Links → Copy link.',
    markets: ['NG', 'GH', 'KE', 'UG', 'TZ', 'ZA', 'RW'],
  },
  paypal_me: {
    id: 'paypal_me',
    name: 'PayPal',
    prefix: 'paypal.me/',
    sample: 'paypal.me/yourname',
    blurb: 'Paste your PayPal.me link',
    acceptsBareHandle: true,
    findIt: 'Find yours in the PayPal app under Send & Request.',
    markets: ['GB', 'US', 'DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'CA', 'AU', 'AE'],
  },
  wise: {
    id: 'wise',
    name: 'Wise',
    prefix: 'wise.com/pay/me/',
    sample: 'wise.com/pay/me/yourname',
    blurb: 'Paste your Wise payment link',
    acceptsBareHandle: true,
    findIt: 'Wise app → Receive → Share payment link.',
    markets: ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'US', 'CA', 'AU'],
  },
  revolut: {
    id: 'revolut',
    name: 'Revolut',
    prefix: 'revolut.me/',
    sample: 'revolut.me/yourname',
    blurb: 'Paste your Revolut link',
    acceptsBareHandle: true,
    findIt: 'Revolut app → your profile → Share your @RevTag.',
    markets: ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'PL'],
  },
  monzo_me: {
    id: 'monzo_me',
    name: 'Monzo',
    prefix: 'monzo.me/',
    sample: 'monzo.me/yourname',
    blurb: 'Paste your Monzo.me link',
    acceptsBareHandle: true,
    findIt: 'Monzo app → Payments → Get paid → Share monzo.me link.',
    markets: ['GB'],
  },
  cash_app: {
    id: 'cash_app',
    name: 'Cash App',
    prefix: 'cash.app/$',
    sample: 'cash.app/$yourcashtag',
    blurb: 'Paste your $Cashtag',
    acceptsBareHandle: true,
    findIt: 'Cash App → your profile → your $Cashtag.',
    markets: ['US', 'GB'],
  },
  venmo: {
    id: 'venmo',
    name: 'Venmo',
    prefix: 'venmo.com/u/',
    sample: 'venmo.com/u/yourname',
    blurb: 'Paste your Venmo username',
    acceptsBareHandle: true,
    findIt: 'Venmo app → Me → your username.',
    markets: ['US'],
  },
  stripe_link: {
    id: 'stripe_link',
    name: 'Stripe',
    prefix: 'buy.stripe.com/',
    sample: 'buy.stripe.com/xxxxxxxx',
    blurb: 'Paste a Stripe payment link',
    // An opaque code. "xxxxxxxx" on its own is not a claim anybody can check.
    acceptsBareHandle: false,
    findIt: 'Stripe Dashboard → Payment Links → Copy link.',
    markets: ['GB', 'US', 'DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'CA', 'AU'],
  },
  square_link: {
    id: 'square_link',
    name: 'Square',
    prefix: 'square.link/u/',
    sample: 'square.link/u/xxxxxxxx',
    blurb: 'Paste a Square checkout link',
    acceptsBareHandle: false,
    findIt: 'Square Dashboard → Online checkout → Copy link.',
    markets: ['US', 'GB', 'CA', 'AU', 'IE'],
  },
  /**
   * ANYTHING ELSE. A trader whose provider nobody here has heard of types the
   * whole address, and it prints. Rule #1: the app's list of providers is not
   * allowed to be the limit of what a business can be paid through.
   */
  other_link: {
    id: 'other_link',
    name: 'Payment link',
    prefix: '',
    sample: 'example.com/pay/you',
    blurb: 'Any other payment address',
    acceptsBareHandle: false,
    markets: [],
  },
}

export const ALL_PROVIDERS: readonly PaymentProvider[] = Object.values(PROVIDERS)

/** True when this provider is declared able to receive money in `country`. */
export const receivesIn = (provider: PaymentProvider, country: string): boolean =>
  provider.markets.includes(country.trim().toUpperCase())

export interface OfferedProviders {
  /** What to show without being asked. Possibly empty, which is honest. */
  readonly offered: readonly PaymentProvider[]
  /** Everything else, behind "Use a different service". Never empty. */
  readonly others: readonly PaymentProvider[]
}

/**
 * What to offer a trader in this country, and what to keep one tap away.
 *
 * `other_link` is always in `others` and never in `offered`: it is the escape
 * hatch, not a suggestion, and putting it in the default list would be
 * offering somebody a blank box before offering them the thing they use.
 */
export function providersFor(country: string): OfferedProviders {
  const offered = ALL_PROVIDERS.filter(
    (provider) => provider.id !== 'other_link' && receivesIn(provider, country),
  )
  const offeredIds = new Set(offered.map((provider) => provider.id))
  return {
    offered,
    others: ALL_PROVIDERS.filter((provider) => !offeredIds.has(provider.id)),
  }
}
