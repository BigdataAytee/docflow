/**
 * Provider webhook verification and normalisation (§Q Phase 5, §271, Rule #3).
 *
 * Tested here, in the app's suite, against the EDGE FUNCTION'S OWN copy — the
 * same arrangement as the public-link rules, so the two runtimes cannot drift
 * into disagreeing about what a valid signature is.
 *
 * What these tests cannot do: talk to a provider. Signature schemes are pinned
 * against known-answer vectors computed independently, which catches a wrong
 * algorithm or a wrong encoding; it does not catch a provider changing their
 * scheme. That needs a merchant account.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  hmacSha512Hex,
  minorFromDecimal,
  normalise,
  sameSecret,
  verify,
} from '../../../supabase/functions/payment-webhook/rules'

const SECRET = 'sk_test_docflow'

const headersWith = (entries: Record<string, string>) => new Headers(entries)

describe('Paystack signs the body, so the body is proven (§271)', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { id: 1 } })

  it('computes the hex HMAC-SHA512 that Paystack computes', async () => {
    // The known answer, from an independent implementation. A wrong digest
    // (SHA-256 is the usual slip) or a wrong encoding fails here.
    const expected = createHmac('sha512', SECRET).update(body).digest('hex')
    expect(await hmacSha512Hex(SECRET, body)).toBe(expected)
    expect(expected).toHaveLength(128)
  })

  it('accepts a correctly signed body', async () => {
    const signature = createHmac('sha512', SECRET).update(body).digest('hex')
    const verdict = await verify(
      'paystack',
      headersWith({ 'x-paystack-signature': signature }),
      body,
      { secret: SECRET },
    )
    expect(verdict.kind).toBe('authentic')
  })

  it('rejects a body changed by even one character', async () => {
    const signature = createHmac('sha512', SECRET).update(body).digest('hex')
    // The attack the signature exists to stop: a real event with the amount
    // edited. The signature is over the RAW bytes, so it no longer matches.
    const tampered = body.replace('"id":1', '"id":2')
    const verdict = await verify(
      'paystack',
      headersWith({ 'x-paystack-signature': signature }),
      tampered,
      { secret: SECRET },
    )
    expect(verdict.kind).toBe('rejected')
  })

  it('rejects a signature made with another merchant secret', async () => {
    const signature = createHmac('sha512', 'sk_test_someone_else').update(body).digest('hex')
    const verdict = await verify(
      'paystack',
      headersWith({ 'x-paystack-signature': signature }),
      body,
      { secret: SECRET },
    )
    expect(verdict.kind).toBe('rejected')
  })

  it('rejects a request with no signature, and one with no secret configured', async () => {
    expect((await verify('paystack', headersWith({}), body, { secret: SECRET })).kind).toBe('rejected')
    expect(
      (await verify('paystack', headersWith({ 'x-paystack-signature': 'x' }), body, {})).kind,
    ).toBe('rejected')
  })
})

describe('Flutterwave signs NOTHING, and the verdict says so (§271, Rule #3)', () => {
  it('never returns authentic, even when the hash matches', async () => {
    const verdict = await verify(
      'flutterwave',
      headersWith({ 'verif-hash': 'shared-secret' }),
      '{"event":"charge.completed"}',
      { secret: 'shared-secret' },
    )

    // `verif-hash` is a STATIC string covering none of the body. Anyone who
    // has seen one request can post any body with the same header, so the
    // amount is not evidence until Flutterwave confirms it.
    expect(verdict.kind).toBe('needs_confirmation')
    expect(verdict.kind === 'needs_confirmation' && verdict.reason).toMatch(/does not sign the body/)
  })

  it('rejects a wrong or absent hash before getting that far', async () => {
    expect(
      (await verify('flutterwave', headersWith({ 'verif-hash': 'wrong' }), '{}', { secret: 's' }))
        .kind,
    ).toBe('rejected')
    expect((await verify('flutterwave', headersWith({}), '{}', { secret: 's' })).kind).toBe('rejected')
  })
})

describe('PayPal is verified by a call to PayPal, not from the request', () => {
  const complete = {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.paypal.com/cert.pem',
    'paypal-transmission-id': 't-1',
    'paypal-transmission-sig': 'sig',
    'paypal-transmission-time': '2026-09-13T00:00:00Z',
  }

  it('never returns authentic on headers alone', async () => {
    const verdict = await verify('paypal', headersWith(complete), '{}', { webhookId: 'WH-1' })
    expect(verdict.kind).toBe('needs_confirmation')
  })

  it('rejects when any header PayPal needs is missing, and names it', async () => {
    for (const missing of Object.keys(complete)) {
      const partial = { ...complete }
      delete partial[missing as keyof typeof complete]
      const verdict = await verify('paypal', headersWith(partial), '{}', { webhookId: 'WH-1' })
      expect(verdict.kind, missing).toBe('rejected')
      expect(verdict.kind === 'rejected' && verdict.reason).toContain(missing)
    }
  })
})

describe('A wrong secret cannot be found one byte at a time', () => {
  it('compares in constant time and still compares correctly', () => {
    expect(sameSecret('abcdef', 'abcdef')).toBe(true)
    expect(sameSecret('abcdef', 'abcdeg')).toBe(false)
    expect(sameSecret('abc', 'abcdef')).toBe(false)
    expect(sameSecret('', '')).toBe(true)
  })
})

describe('Major units become minor units without a float (Rule #3)', () => {
  it('converts the ordinary amounts correctly', () => {
    expect(minorFromDecimal('500.10', 100)).toBe(50_010)
    expect(minorFromDecimal('1.005', 1000)).toBe(1005)
    expect(minorFromDecimal('0.07', 100)).toBe(7)
    expect(minorFromDecimal('500', 100)).toBe(50_000)
    expect(minorFromDecimal('500.1', 100)).toBe(50_010)
    expect(minorFromDecimal(500.1, 100)).toBe(50_010)
  })

  it('refuses the inputs `Number()` would quietly coerce into money', () => {
    // The actual reason this is not `Math.round(Number(text) * scale)`.
    // `Number('')` is 0, so a MISSING amount would record as zero money: the
    // payment lands, the invoice stays unpaid, and nothing says why.
    expect(Number('')).toBe(0)
    expect(minorFromDecimal('', 100)).toBeNull()

    // And these are not the amounts they look like.
    expect(Number('0x10')).toBe(16)
    expect(minorFromDecimal('0x10', 100)).toBeNull()
    expect(Number('5e2')).toBe(500)
    expect(minorFromDecimal('5e2', 100)).toBeNull()
  })

  it('refuses where float rounding genuinely does not recover', () => {
    // `Math.round(1.005 * 100)` is 100, not 101 — binary cannot hold 1.005 and
    // the rounding goes the wrong way. Refusing beats recording a kobo less.
    expect(Math.round(1.005 * 100)).toBe(100)
    expect(minorFromDecimal('1.005', 100)).toBeNull()
  })

  it('leaves a zero-decimal currency alone', () => {
    expect(minorFromDecimal('1500', 1)).toBe(1500)
  })

  it('refuses more precision than the currency has, rather than truncating', () => {
    // Truncating "500.999" to 50099 silently discards someone's money.
    expect(minorFromDecimal('500.999', 100)).toBeNull()
  })

  it('refuses anything that is not a plain decimal', () => {
    for (const bad of ['', ' ', 'abc', '5e2', '1,000.00', '0x10', '1.2.3', '+5']) {
      expect(minorFromDecimal(bad, 100), bad).toBeNull()
    }
  })

  it('refuses an amount too large to count exactly', () => {
    expect(minorFromDecimal('99999999999999999999', 100)).toBeNull()
  })
})

describe('Only a completed charge is money (§K)', () => {
  const paystack = (over: object = {}) => ({
    event: 'charge.success',
    data: {
      id: 302961,
      status: 'success',
      reference: 'INV-0007',
      amount: 50_000,
      currency: 'NGN',
      paid_at: '2026-09-13T10:00:00Z',
      customer: { email: 'ada@example.test' },
      ...over,
    },
  })

  it('reads a Paystack amount as the minor units it already is', () => {
    const result = normalise('paystack', paystack())
    expect(result.kind).toBe('payment')
    // 50000 kobo is ₦500.00. Multiplying by 100 here would record ₦50,000.
    expect(result.kind === 'payment' && result.payment.amountMinor).toBe(50_000)
    expect(result.kind === 'payment' && result.payment.externalEventId).toBe('paystack:302961')
  })

  it('reads a Flutterwave amount as the major units it is', () => {
    const result = normalise('flutterwave', {
      event: 'charge.completed',
      data: {
        id: 998877,
        status: 'successful',
        tx_ref: 'INV-0007',
        amount: 500.1,
        currency: 'NGN',
        created_at: '2026-09-13T10:00:00Z',
      },
    })
    // The same ₦500.10 that Paystack would have sent as 50010.
    expect(result.kind === 'payment' && result.payment.amountMinor).toBe(50_010)
  })

  it('reads a PayPal capture value as major units', () => {
    const result = normalise('paypal', {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: '8AB12345',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '25.00' },
        custom_id: 'INV-0007',
        create_time: '2026-09-13T10:00:00Z',
      },
    })
    expect(result.kind === 'payment' && result.payment.amountMinor).toBe(2_500)
    expect(result.kind === 'payment' && result.payment.externalEventId).toBe('paypal:8AB12345')
  })

  it('ignores a charge that did not succeed, for every provider', () => {
    expect(normalise('paystack', paystack({ status: 'failed' })).kind).toBe('ignored')
    expect(
      normalise('flutterwave', {
        event: 'charge.completed',
        data: { id: 1, status: 'pending', tx_ref: 'x', amount: 1, currency: 'NGN' },
      }).kind,
    ).toBe('ignored')
    expect(
      normalise('paypal', {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'x', status: 'PENDING', amount: { currency_code: 'USD', value: '1.00' } },
      }).kind,
    ).toBe('ignored')
  })

  it('ignores an event that is not a charge at all', () => {
    expect(normalise('paystack', { event: 'transfer.success', data: {} }).kind).toBe('ignored')
    expect(normalise('paypal', { event_type: 'BILLING.SUBSCRIPTION.CREATED' }).kind).toBe('ignored')
  })

  it('refuses a currency whose minor units it does not know', () => {
    // Scaling an unknown currency by 100 would record a hundred times the
    // money for a zero-decimal one.
    const result = normalise('flutterwave', {
      event: 'charge.completed',
      data: { id: 1, status: 'successful', tx_ref: 'x', amount: '1500', currency: 'ZZZ' },
    })
    expect(result.kind).toBe('malformed')
  })

  it('refuses a Paystack amount that is not a whole number of minor units', () => {
    expect(normalise('paystack', paystack({ amount: 500.5 })).kind).toBe('malformed')
    expect(normalise('paystack', paystack({ amount: '50000' })).kind).toBe('malformed')
  })

  it('keys on the transaction, so two events about one charge are one payment (§M)', () => {
    const first = normalise('paystack', paystack())
    const redelivered = normalise('paystack', paystack({ paid_at: '2026-09-13T11:00:00Z' }))
    expect(first.kind === 'payment' && first.payment.externalEventId).toBe(
      redelivered.kind === 'payment' && redelivered.payment.externalEventId,
    )
  })
})
