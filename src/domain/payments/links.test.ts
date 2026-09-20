/**
 * Pasting a payment link, from whichever part of it somebody copied (§J, §K).
 *
 * The feature lives or dies here. A trader copies their link from another app
 * on the same phone, and what lands on the clipboard depends entirely on
 * which part of the screen they long-pressed. A form that accepts one shape
 * and rejects the rest is a form abandoned at the first attempt.
 *
 * The property is a FOLD: every shape of the same account collapses to one
 * value, and that value is what prints. Written as a table rather than as
 * separate cases so a new provider cannot be added with only its happy path.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { normaliseProviderLink, printedLine } from './links'
import { ALL_PROVIDERS, PROVIDERS, providersFor, receivesIn } from './providers'
import type { ProviderId } from './providers'

const value = (id: ProviderId, raw: string): string | undefined =>
  normaliseProviderLink(id, raw).value

describe('Every shape of one link is one value (§J, §K)', () => {
  /**
   * THE ONE THIS IS FOR. Six ways of copying the same PayPal account, one
   * stored string — and it is the string the invoice prints.
   */
  it.each([
    'paypal.me/ade',
    'https://paypal.me/ade',
    'http://paypal.me/ade',
    'https://www.paypal.me/ade/',
    'https://paypal.me/ade?utm_source=share&fbclid=xyz',
    '  paypal.me/ade  ',
    'PayPal.Me/ade',
    'ade',
  ])('stores %s as one value', (raw) => {
    expect(value('paypal_me', raw)).toBe('paypal.me/ade')
  })

  /**
   * AND FOR EVERY PROVIDER THAT TAKES A BARE HANDLE, not just the one that
   * got written first. A table, so a provider added tomorrow is covered by
   * having been added rather than by somebody remembering.
   */
  it.each(ALL_PROVIDERS.filter((provider) => provider.acceptsBareHandle).map((p) => p.id))(
    'folds every shape for %s',
    (id) => {
      const provider = PROVIDERS[id]
      const expected = `${provider.prefix}abc`
      for (const raw of [
        `${provider.prefix}abc`,
        `https://${provider.prefix}abc`,
        `https://www.${provider.prefix}abc/`,
        `${provider.prefix}abc?utm_campaign=x`,
        `  ${provider.prefix.toUpperCase()}abc `,
        'abc',
      ]) {
        expect(value(id, raw), `${id} rejected ${raw}`).toBe(expected)
      }
    },
  )

  /**
   * THE HANDLE'S CASE SURVIVES and the host's does not. A host is
   * case-insensitive by definition; a handle is a name somebody chose, and
   * rewriting it is §K's "destroying what was typed", one letter at a time.
   */
  it('lowercases the host and leaves the name alone', () => {
    expect(value('paypal_me', 'PayPal.Me/AdeOlu')).toBe('paypal.me/AdeOlu')
  })

  /** A tracking parameter is somebody else's analytics, not an address. */
  it('drops tracking and keeps anything else', () => {
    expect(value('other_link', 'pay.example.com/x?utm_source=wa&ref=y')).toBe(
      'pay.example.com/x',
    )
    expect(
      value('other_link', 'pay.example.com/x?order=91'),
      'a parameter that is part of the address was thrown away',
    ).toBe('pay.example.com/x?order=91')
  })

  /**
   * AN OPAQUE CODE IS NOT A HANDLE. A Stripe payment link is
   * `buy.stripe.com/aEU5kC1x2`, and accepting `aEU5kC1x2` alone would be
   * accepting any word anybody typed.
   */
  it('refuses a bare code where the shape cannot confirm it', () => {
    expect(normaliseProviderLink('stripe_link', 'aEU5kC1x2').problem).toBe('not_this_provider')
    expect(value('stripe_link', 'buy.stripe.com/aEU5kC1x2')).toBe('buy.stripe.com/aEU5kC1x2')
  })

  /** Somebody else's link in this field is a different mistake, said its own way. */
  it('says a Wise link is not a PayPal one', () => {
    expect(normaliseProviderLink('paypal_me', 'wise.com/pay/me/ade').problem).toBe(
      'not_this_provider',
    )
  })

  it('refuses a prefix with nothing after it', () => {
    expect(normaliseProviderLink('paypal_me', 'paypal.me/').problem).toBe('no_handle')
    expect(normaliseProviderLink('paypal_me', '   ').problem).toBe('empty')
  })

  /** The escape hatch takes anything that looks like somewhere to go. */
  it('accepts an address nobody here has heard of', () => {
    expect(value('other_link', 'https://pay.mybank.ng/dynamic/')).toBe('pay.mybank.ng/dynamic')
    expect(normaliseProviderLink('other_link', 'not a link').problem).toBe('not_a_link')
  })

  /**
   * §K, AS A PROPERTY: nothing is ever rewritten into something that then
   * normalises differently. Feed the output back in and it must not move —
   * otherwise the line shown under the field is not the line that was stored.
   */
  it('is idempotent for every provider and any handle', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PROVIDERS.map((provider) => provider.id)),
        fc.stringMatching(/^[A-Za-z0-9_.$-]{1,24}$/),
        (id, handle) => {
          const once = normaliseProviderLink(id, `${PROVIDERS[id].prefix}${handle}`)
          if (once.value === undefined) return
          expect(normaliseProviderLink(id, once.value).value).toBe(once.value)
        },
      ),
      { numRuns: 300 },
    )
  })

  /** §K: a rejected paste never clears the field — nothing is handed back. */
  it('returns no value at all when it refuses', () => {
    const rejected = normaliseProviderLink('paypal_me', 'wise.com/pay/me/ade')
    expect(rejected.value).toBeUndefined()
  })
})

describe('The saved line is the printed line (§J, §I)', () => {
  /**
   * §J's whole clause: "declared once, read by both the settings form and the
   * printed box, so they cannot drift". There is one string, so this asserts
   * there is no second derivation hiding anywhere.
   */
  it('prints the provider’s name and the stored value, unchanged', () => {
    const saved = { provider: 'paypal_me' as const, value: 'paypal.me/AdeOlu' }
    expect(printedLine(saved)).toEqual({ label: 'PayPal', value: 'paypal.me/AdeOlu' })
  })

  it('names every provider in words a customer would recognise', () => {
    for (const provider of ALL_PROVIDERS) {
      expect(provider.name).not.toMatch(/_/)
      expect(provider.name.length).toBeGreaterThan(2)
    }
  })
})

describe('What a country is offered, and what stays reachable (§J, §N)', () => {
  /**
   * THE ONE THE OWNER ASKED FOR. A Nigerian trader sees the two that can take
   * Nigerian money; nothing that cannot appears by default — no popup, no
   * warning, no region selector, the wrong options simply are not there.
   */
  it('offers Nigeria Paystack and Flutterwave, and not PayPal', () => {
    const { offered } = providersFor('NG')
    const ids = offered.map((provider) => provider.id)
    expect(ids).toContain('paystack_page')
    expect(ids).toContain('flutterwave_page')
    expect(ids, 'a link that cannot receive in Nigeria was offered').not.toContain('paypal_me')
  })

  it('offers Germany PayPal, Wise, Revolut and Stripe', () => {
    const ids = providersFor('DE').offered.map((provider) => provider.id)
    for (const id of ['paypal_me', 'wise', 'revolut', 'stripe_link']) expect(ids).toContain(id)
  })

  /**
   * AND NOTHING IS LOCKED AWAY. The country list that shipped with thirteen
   * entries is the lesson: an automatic choice is a default, never a gate. A
   * trader holding an account elsewhere reaches it from anywhere.
   */
  it.each(['NG', 'DE', 'US', 'GB', 'ZZ'])('keeps every provider reachable from %s', (country) => {
    const { offered, others } = providersFor(country)
    const reachable = new Set([...offered, ...others].map((provider) => provider.id))
    for (const provider of ALL_PROVIDERS) {
      expect(reachable.has(provider.id), `${provider.id} is unreachable from ${country}`).toBe(
        true,
      )
    }
  })

  /** An unknown country offers nothing rather than guessing, and hides nothing. */
  it('offers nothing it cannot stand behind', () => {
    expect(providersFor('ZZ').offered).toEqual([])
    expect(providersFor('ZZ').others.length).toBe(ALL_PROVIDERS.length)
  })

  /**
   * The escape hatch is never a SUGGESTION. Offering somebody a blank box
   * before offering them the thing they use is the wrong order.
   */
  it.each(['NG', 'DE', 'US'])('never offers "other" by default in %s', (country) => {
    expect(providersFor(country).offered.map((p) => p.id)).not.toContain('other_link')
    expect(providersFor(country).others.map((p) => p.id)).toContain('other_link')
  })

  /** And the note beside an opened-anyway provider has something to say. */
  it('can tell whether a provider receives where the trader is', () => {
    expect(receivesIn(PROVIDERS['paypal_me'], 'NG')).toBe(false)
    expect(receivesIn(PROVIDERS['paypal_me'], 'de')).toBe(true)
  })
})
