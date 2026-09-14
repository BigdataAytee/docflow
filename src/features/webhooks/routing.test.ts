/**
 * How the endpoint answers, which is a decision and not an implementation
 * detail (§P, §271).
 *
 * The handler itself is Deno and imports from a URL, so what is pinned here is
 * the reasoning it encodes — routing, and the shape of a refusal — expressed
 * against the same rules module the function uses.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

describe('What the webhooks do about rate limiting, and why (§P, §Q Phase 7)', () => {
  const sourceOf = (file: string): string =>
    readFileSync(resolve(process.cwd(), 'supabase/functions', file), 'utf8').replace(
      /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
      '',
    )

  it('leaves the payment webhook unlimited, because the signature is the limit', () => {
    // A limiter in front of a payment provider throttles the PROVIDER — the
    // callers are Paystack's own addresses, a day's settlements arrive in a
    // burst, and a dropped event is money the ledger never hears about.
    //
    // What makes that safe is that an unsigned caller cannot make this
    // endpoint do any work worth flooding for: every write is below the
    // signature check, and the only thing above it is one indexed lookup of
    // the company's credentials. That is the property, so it is asserted
    // rather than described.
    const code = sourceOf('payment-webhook/index.ts')
    const gate = code.indexOf('await verify(')
    expect(gate).toBeGreaterThan(0)

    const before = code.slice(0, gate)
    expect(before).not.toMatch(/\.rpc\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/)
    expect(before.match(/\.from\(/g) ?? []).toHaveLength(1)
  })

  it('limits the store endpoint, because an unsigned caller CAN make it write', () => {
    // The parked ledger row is written before any signature is verified, and
    // its id comes out of the body — distinct ids, unbounded rows. So that
    // one write is bucketed, per company, while the verified path is not
    // throttled at all: dropping a real store event loses a subscription.
    const code = sourceOf('store-notifications/index.ts')
    const park = code.indexOf("from('store_billing_events')")
    expect(park).toBeGreaterThan(0)

    const limit = code.indexOf('overLimit(admin, STORE_PARK_BUCKET')
    expect(limit).toBeGreaterThan(0)
    expect(limit).toBeLessThan(park)

    // And nothing throttles the verified path.
    expect(code.indexOf('apply_store_billing_event')).toBeGreaterThan(limit)
    expect(code.match(/overLimit\(/g) ?? []).toHaveLength(1)
  })
})
