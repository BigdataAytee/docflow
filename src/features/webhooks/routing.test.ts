/**
 * How the endpoint answers, which is a decision and not an implementation
 * detail (§P, §271).
 *
 * The handler itself is Deno and imports from a URL, so what is pinned here is
 * the reasoning it encodes — routing, and the shape of a refusal — expressed
 * against the same rules module the function uses.
 */

import { describe, expect, it } from 'vitest'

import { PROVIDERS, isProvider, routeOf } from '../../../supabase/functions/payment-webhook/rules'

// The function's OWN parser, not a copy of it. A re-implementation here would
// pass while the handler did something else entirely.
const route = routeOf

describe('The company is named in the path, and is not the authority (§P)', () => {
  it('reads the provider and the company from the URL', () => {
    // Nothing in a Paystack charge says which DocFlow company it belongs to —
    // we did not create the charge. The merchant pointed their own dashboard
    // at this URL, so the company has to be in it.
    expect(route('/payment-webhook/paystack/11111111-1111-1111-1111-111111111111')).toEqual({
      provider: 'paystack',
      companyId: '11111111-1111-1111-1111-111111111111',
    })
  })

  it('refuses a provider it does not implement', () => {
    expect(route('/payment-webhook/stripe/co_1')).toBeNull()
    expect(route('/payment-webhook//co_1')).toBeNull()
  })

  it('refuses a route with no company at all', () => {
    expect(route('/payment-webhook/paystack')).toBeNull()
  })

  it('covers exactly the three providers §Q names', () => {
    expect([...PROVIDERS]).toEqual(['paystack', 'flutterwave', 'paypal'])
    for (const provider of PROVIDERS) expect(isProvider(provider)).toBe(true)
    expect(isProvider('mystery')).toBe(false)
  })
})
