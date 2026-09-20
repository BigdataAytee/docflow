/**
 * Turning whatever somebody pasted into the one line that prints (§J, §K).
 *
 * This decides whether the feature gets used. A trader copies their link from
 * another app on the same phone, and what lands on the clipboard depends
 * entirely on which part of the screen they happened to long-press:
 *
 *     paypal.me/ade
 *     https://paypal.me/ade
 *     https://www.paypal.me/ade/
 *     https://paypal.me/ade?utm_source=share&fbclid=x
 *     PayPal.Me/Ade
 *     ade
 *
 * Every one of those is the same account, and a form that accepts one and
 * rejects the rest is a form that gets abandoned at the first attempt. They
 * all normalise to `paypal.me/ade`, which is exactly what the invoice prints.
 *
 * ONE VALUE, STORED AND PRINTED. There is no display form and stored form to
 * drift apart — the normalised string IS the line on the page (§J's "declared
 * once, read by both"), so what somebody sees under the field while they type
 * is the thing their customer will read.
 *
 * §K THROUGHOUT: "validate without destroying what was typed". Nothing here
 * rewrites the caller's input or clears a field. It reports a problem and
 * hands back what it was given.
 */

import { type PaymentProvider, PROVIDERS, type ProviderId } from './providers'

/**
 * Query keys that are somebody else's analytics, not part of the address.
 *
 * Stripped rather than kept: a tracking parameter on a printed invoice is
 * noise a customer has to read past, it can be long enough to wrap the line,
 * and it carries where the trader copied the link from — which is nobody's
 * business but theirs.
 */
const TRACKING = /^(utm_|fbclid$|gclid$|igshid$|mc_|ref$|source$|si$)/i

export type LinkProblem = 'empty' | 'not_this_provider' | 'no_handle' | 'not_a_link'

export interface LinkResult {
  /** The single value: stored, shown back, and printed (§J). */
  readonly value: string
  readonly problem?: undefined
}

export interface LinkRejected {
  readonly value?: undefined
  readonly problem: LinkProblem
}

/** Everything a URL carries that an address does not. */
function stripped(raw: string): string {
  let text = raw.trim()
  // A scheme is optional on the way in and absent on the way out: the line
  // reads as an address on paper, not as markup.
  text = text.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  text = text.replace(/^www\./i, '')
  // A fragment is never part of a payment address.
  const hash = text.indexOf('#')
  if (hash !== -1) text = text.slice(0, hash)

  const query = text.indexOf('?')
  if (query !== -1) {
    const path = text.slice(0, query)
    /*
     * KEPT IF IT IS NOT TRACKING. Some providers really do carry a parameter
     * that is part of the address, so this drops what it recognises rather
     * than dropping everything — the opposite default would silently break a
     * working link, which is worse than printing one extra parameter.
     */
    const kept = text
      .slice(query + 1)
      .split('&')
      .filter((pair) => pair !== '' && !TRACKING.test(pair.split('=')[0] ?? ''))
    text = kept.length === 0 ? path : `${path}?${kept.join('&')}`
  }

  // A trailing slash is how a browser writes a path, not how a person does.
  return text.replace(/\/+$/, '')
}

/** `paypal.me/` and `PayPal.Me/` are the same prefix. */
const startsWithPrefix = (text: string, prefix: string): boolean =>
  prefix !== '' && text.toLowerCase().startsWith(prefix.toLowerCase())

/**
 * What to store for this provider, or why it cannot be stored.
 *
 * THE HANDLE'S CASE SURVIVES, and the host's does not. `PayPal.Me/Ade` prints
 * as `paypal.me/Ade`: a host is case-insensitive by definition and looks
 * wrong shouted, but a handle can be case-sensitive at the provider and is a
 * name somebody chose — rewriting it is the §K failure of destroying input,
 * one letter at a time.
 */
export function normaliseProviderLink(
  providerId: ProviderId,
  raw: string,
): LinkResult | LinkRejected {
  const provider: PaymentProvider = PROVIDERS[providerId]
  const text = stripped(raw)
  if (text === '') return { problem: 'empty' }

  /*
   * ANY ADDRESS AT ALL, for the escape hatch. `other_link` has no prefix to
   * check against, so the only question is whether this looks like something
   * a customer could open: a dot, and something on each side of it.
   */
  if (provider.prefix === '') {
    return /^[^\s/.]+\.[^\s/.]+/.test(text) ? { value: text } : { problem: 'not_a_link' }
  }

  /*
   * THE PREFIX WITH NOTHING AFTER IT. A trailing slash is stripped above, so
   * `paypal.me/` arrives here as `paypal.me` — the right host and no handle,
   * which is a different thing to say than "that is not a PayPal link".
   */
  const bare = provider.prefix.replace(/[/$]+$/, '')
  if (bare !== '' && text.toLowerCase() === bare.toLowerCase()) return { problem: 'no_handle' }

  if (startsWithPrefix(text, provider.prefix)) {
    const handle = text.slice(provider.prefix.length)
    if (handle === '') return { problem: 'no_handle' }
    // The prefix as DECLARED, the handle as TYPED.
    return { value: `${provider.prefix}${handle}` }
  }

  /*
   * A WHOLE LINK FOR A DIFFERENT PROVIDER is a different mistake from a bare
   * handle, and worth a different sentence: somebody has pasted their Wise
   * link into the PayPal field, and telling them "that is not a name" would
   * send them looking for the wrong thing.
   */
  if (text.includes('/') || text.includes('.')) {
    return { problem: 'not_this_provider' }
  }

  if (!provider.acceptsBareHandle) return { problem: 'not_this_provider' }
  return { value: `${provider.prefix}${text}` }
}

/**
 * One saved method, as it is stored and as it prints.
 *
 * `value` is already normalised; nothing downstream re-derives it. That is
 * the point — the settings form, the document's own list and `buildPaymentBox`
 * all read this same string, so §J's "cannot drift" holds by there being only
 * one of it.
 */
export interface SavedPaymentLink {
  readonly provider: ProviderId
  readonly value: string
}

/** What prints under HOW TO PAY: the provider's name, then the address (§I). */
export const printedLine = (link: SavedPaymentLink): { label: string; value: string } => ({
  label: PROVIDERS[link.provider].name,
  value: link.value,
})
