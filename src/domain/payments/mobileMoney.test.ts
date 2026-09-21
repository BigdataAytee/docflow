/**
 * Mobile money: a number and a name, not a link (§J, §K).
 *
 * How a very large share of this app's market is actually paid, and the
 * reason the link list was not enough: a trader in Kumasi is not pasting a
 * URL, they are telling a customer a phone number — and that customer types
 * the number, waits for a name to come back, and checks it before
 * confirming. Printing one without the other asks them to send money
 * somewhere and check nothing.
 *
 * The rules that follow from that are the ones asserted here.
 */

import { describe, expect, it } from 'vitest'

import { normaliseProviderLink, normaliseWalletNumber, printedLine } from './links'
import { ALL_PROVIDERS, PROVIDERS, providersFor } from './providers'
import type { ProviderId } from './providers'

const WALLETS = ALL_PROVIDERS.filter((provider) => provider.kind === 'mobile_money')

describe('A wallet number survives being typed (§K)', () => {
  /**
   * THE ONE THIS IS FOR. §K: identifiers are strings, leading zeroes kept,
   * "spaces/hyphens allowed for readability". A wallet number is read aloud
   * down a phone in whatever grouping its owner uses, and rewriting
   * `0803 456 7890` into `08034567890` is the app deciding it knows their
   * number better than they do.
   */
  it.each([
    '0803 456 7890',
    '0803-456-7890',
    '+233 24 123 4567',
    '(024) 123 4567',
    '0712345678',
  ])('keeps %s as it was typed', (raw) => {
    expect(normaliseWalletNumber(raw).value).toBe(raw)
  })

  /** Only the whitespace a keyboard doubles up is tidied. */
  it('collapses runs of spaces and nothing else', () => {
    expect(normaliseWalletNumber('  0803   456  7890 ').value).toBe('0803 456 7890')
  })

  /** A leading zero is part of the number, not a formatting artefact. */
  it('never drops a leading zero', () => {
    expect(normaliseWalletNumber('0712345678').value).toBe('0712345678')
  })

  /**
   * AND SOMETHING THAT IS NOT A NUMBER IS REFUSED. A customer cannot send
   * money to a sentence, and §K says so beside the field without clearing it.
   */
  it.each(['my mtn line', 'call me', 'paypal.me/ade', '12345'])(
    'refuses %s',
    (raw) => {
      const outcome = normaliseWalletNumber(raw)
      expect(outcome.problem).toBe('not_a_number')
      expect(outcome.value, 'a refusal handed something back').toBeUndefined()
    },
  )

  it('refuses an empty one as empty, not as malformed', () => {
    expect(normaliseWalletNumber('   ').problem).toBe('empty')
  })

  /**
   * A WALLET NEVER GOES THROUGH THE URL CLEANER. Sending a phone number
   * through it would strip the punctuation somebody wrote it with and then
   * reject it for having no dot in it — a confusing message about the wrong
   * thing.
   */
  it.each(WALLETS.map((provider) => provider.id))('asks %s the right question', (id) => {
    expect(normaliseProviderLink(id, '0803 456 7890').value).toBe('0803 456 7890')
    expect(normaliseProviderLink(id, 'not a number').problem).toBe('not_a_number')
  })
})

describe('The printed line carries both facts (§I, §J)', () => {
  /**
   * THE ONE THIS IS FOR. "0803 456 7890" alone is half of what a customer
   * needs to be sure; the name is what they check before they confirm.
   */
  it('prints the number and the name on the account', () => {
    expect(printedLine({ provider: 'opay', value: '0803 456 7890', accountName: 'Sola Ventures' }))
      .toEqual({ label: 'OPay', value: '0803 456 7890 · Sola Ventures' })
  })

  /** A wallet with no name yet prints the number rather than a stray bullet. */
  it('prints the number alone when there is no name', () => {
    expect(printedLine({ provider: 'opay', value: '0803 456 7890' }).value).toBe('0803 456 7890')
    expect(printedLine({ provider: 'opay', value: '0803 456 7890', accountName: '  ' }).value).toBe(
      '0803 456 7890',
    )
  })

  /** And a link is untouched by any of this. */
  it('leaves a link exactly as it was', () => {
    expect(printedLine({ provider: 'paypal_me', value: 'paypal.me/ade' }).value).toBe(
      'paypal.me/ade',
    )
  })
})

describe('Where the wallets are offered (§J, §N)', () => {
  /**
   * A NIGERIAN TRADER SEES THE NIGERIAN ONES. The same rule the links follow,
   * and it matters more here: a wallet that does not operate in somebody's
   * country is a number their customer cannot send to.
   */
  it('offers Nigeria OPay, PalmPay and the operators that run there', () => {
    const ids = providersFor('NG').offered.map((provider) => provider.id)
    expect(ids).toContain('opay')
    expect(ids).toContain('palmpay')
    expect(ids, 'a wallet that does not run in Nigeria was offered').not.toContain('mpesa')
  })

  it('offers Kenya M-Pesa and Airtel Money, and not OPay', () => {
    const ids = providersFor('KE').offered.map((provider) => provider.id)
    expect(ids).toContain('mpesa')
    expect(ids).toContain('airtel_money')
    expect(ids).not.toContain('opay')
  })

  it('offers Senegal Wave and Orange Money', () => {
    const ids = providersFor('SN').offered.map((provider) => provider.id)
    expect(ids).toContain('wave')
    expect(ids).toContain('orange_money')
  })

  /** And every one stays reachable from anywhere, like every other provider. */
  it.each(['NG', 'KE', 'GB', 'ZZ'])('keeps every wallet reachable from %s', (country) => {
    const { offered, others } = providersFor(country)
    const reachable = new Set([...offered, ...others].map((provider) => provider.id))
    for (const wallet of WALLETS) {
      expect(reachable.has(wallet.id), `${wallet.id} is unreachable from ${country}`).toBe(true)
    }
  })
})

describe('Every wallet is declared like every other provider (§J)', () => {
  it('names itself in words a customer would recognise', () => {
    for (const wallet of WALLETS) {
      expect(wallet.name).not.toMatch(/_/)
      expect(wallet.blurb.length).toBeGreaterThan(8)
      // A wallet asks for a number, so it has no link shape to complete.
      expect(wallet.prefix, `${wallet.id} carries a link prefix`).toBe('')
      expect(wallet.acceptsBareHandle, `${wallet.id} claims to take a handle`).not.toBe(true)
    }
  })

  /** A short list, on purpose — see the caution in PLAN.md. */
  it('keeps its market list short enough for somebody to check', () => {
    for (const wallet of WALLETS) {
      expect(wallet.markets.length, `${wallet.id} claims too many markets to verify`).toBeLessThan(
        15,
      )
      expect(wallet.markets.length, `${wallet.id} claims none`).toBeGreaterThan(0)
    }
  })

  /** There are some, which is the guard against this file testing nothing. */
  it('declares wallets at all', () => {
    expect(WALLETS.length).toBeGreaterThan(4)
    expect(PROVIDERS['mtn_momo' as ProviderId].kind).toBe('mobile_money')
  })
})
