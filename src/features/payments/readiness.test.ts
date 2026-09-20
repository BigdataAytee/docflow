/**
 * Usable, not merely switched on (§J, §G step 5).
 *
 * The fields come from §J's currency definition and nowhere else, so these
 * also stand guard over the thing §J is emphatic about: NGN has three fields,
 * and no sort code is invented for a country that has none.
 */

import { describe, expect, it } from 'vitest'

import { unusableMethods, usableMethodCount } from './readiness'

const NGN_COMPLETE = {
  bank_name: 'Guaranty Trust Bank',
  account_number: '0123456789',
  account_name: 'Dynamic Renaissance Ltd',
}

describe('Bank transfer needs the account behind it', () => {
  it('is unusable with nothing filled', () => {
    expect(
      unusableMethods({ currency: 'NGN', enabled: ['bank_transfer'], bankValues: {} }),
    ).toEqual(['bank_transfer'])
  })

  /** Two of three is not "set up". The printed box would be missing a line. */
  it('is unusable half-filled', () => {
    expect(
      unusableMethods({
        currency: 'NGN',
        enabled: ['bank_transfer'],
        bankValues: { bank_name: 'Guaranty Trust Bank', account_number: '0123456789' },
      }),
    ).toEqual(['bank_transfer'])
  })

  it('is usable once §J’s three fields are there', () => {
    expect(
      unusableMethods({
        currency: 'NGN',
        enabled: ['bank_transfer'],
        bankValues: NGN_COMPLETE,
      }),
    ).toEqual([])
  })

  /**
   * Whitespace is not a bank name. `validateBankDetails` trims, and this
   * check inherits that rather than deciding it again.
   */
  it('treats blanks as empty', () => {
    expect(
      unusableMethods({
        currency: 'NGN',
        enabled: ['bank_transfer'],
        bankValues: { ...NGN_COMPLETE, account_name: '   ' },
      }),
    ).toEqual(['bank_transfer'])
  })

  /**
   * THE FIELDS ARE §J'S, NOT THIS FILE'S. A GBP account needs a sort code and
   * an NGN one must never be asked for one — the same definition that renders
   * the form and the printed box decides here too.
   */
  it('asks each currency for its own fields', () => {
    const withoutSortCode = {
      currency: 'GBP',
      enabled: ['bank_transfer'],
      bankValues: { bank_name: 'Barclays', account_number: '12345678', account_name: 'Ada' },
    }
    expect(unusableMethods(withoutSortCode)).toEqual(['bank_transfer'])

    // And the same three satisfy NGN completely, sort code nowhere in sight.
    expect(
      unusableMethods({ currency: 'NGN', enabled: ['bank_transfer'], bankValues: NGN_COMPLETE }),
    ).toEqual([])
  })
})

describe('A method with nothing to configure is ready when it is on', () => {
  it('never holds up cash on delivery', () => {
    expect(
      unusableMethods({ currency: 'NGN', enabled: ['cash_on_delivery'], bankValues: {} }),
    ).toEqual([])
  })

  /**
   * The case that matters most: an empty bank account does NOT block issue
   * when something else can actually take the money.
   */
  it('counts the one that works when the other does not', () => {
    expect(
      usableMethodCount({
        currency: 'NGN',
        enabled: ['bank_transfer', 'cash_on_delivery'],
        bankValues: {},
      }),
    ).toBe(1)
  })

  it('counts none when nothing is switched on', () => {
    expect(usableMethodCount({ currency: 'NGN', enabled: [], bankValues: {} })).toBe(0)
  })
})

/**
 * A PASTED LINK IS A WAY TO BE PAID (§J, §G step 5).
 *
 * Found on the phone, one screen after the in-document + shipped. A trader
 * pasted their Paystack page into the control on the invoice, watched
 * "Paystack — paystack.com/pay/dynamic-renaissance" appear in HOW TO PAY on
 * the page in front of them, and was still told "Before you can issue this:
 * set up how you get paid."
 *
 * The gate counted `enabledPaymentMethods`, and links do not live there. But
 * the gate exists to stop an invoice a customer has no way to pay, and that
 * customer had one — printed, in words, on the document. Refusing over it is
 * the check mistaking its own bookkeeping for the thing it protects.
 */
describe('A pasted link is a way to be paid (§J, §G)', () => {
  const noBank = { currency: 'NGN', enabled: [] as string[], bankValues: {} }

  it('counts a link when nothing else is switched on', () => {
    expect(
      usableMethodCount({
        ...noBank,
        links: [{ provider: 'paystack_page', value: 'paystack.com/pay/dynamic' }],
      }),
      'an invoice printing a payment link was refused for having no way to pay',
    ).toBe(1)
  })

  it('still counts nothing when there is nothing', () => {
    expect(usableMethodCount(noBank)).toBe(0)
    expect(usableMethodCount({ ...noBank, links: [] })).toBe(0)
  })

  /** An empty value cannot reach here through the form, and is refused anyway. */
  it('does not count a link with nothing in it', () => {
    expect(
      usableMethodCount({ ...noBank, links: [{ provider: 'paypal_me', value: '  ' }] }),
    ).toBe(0)
  })

  /** And it adds to a usable bank account rather than replacing it. */
  it('counts alongside an account that is filled in', () => {
    expect(
      usableMethodCount({
        currency: 'NGN',
        enabled: ['bank_transfer'],
        bankValues: {
          bank_name: 'Zenith Bank',
          account_number: '1234567890',
          account_name: 'Dynamic Renaissance',
        },
        links: [{ provider: 'paystack_page', value: 'paystack.com/pay/dynamic' }],
      }),
    ).toBe(2)
  })
})
