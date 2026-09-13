/**
 * Provider payment webhooks (§Q Phase 5, §271, §P).
 *
 * §271: "provider-backed payments are confirmed only by a verified, idempotent
 * provider event." This is where "verified" and "idempotent" are enforced.
 *
 * Service-role, like `public-link`, and for the same reason: the caller is not
 * a DocFlow user at all. A provider posts here with no session, and RLS scopes
 * every write to a company, so there is no anon-key path that could record the
 * payment without opening every other company's ledger.
 *
 *   POST /payment-webhook/:provider/:companyId
 *
 * The company is in the PATH because nothing in a Paystack charge says which
 * DocFlow company it belongs to — we did not create the charge; the merchant
 * pointed their own dashboard at this URL. The id selects WHICH secret to
 * check against and is not itself authority: an attacker who knows it still
 * cannot produce a signature.
 *
 * **What this function will not do.** Two of the three providers cannot be
 * verified from the request alone (see `rules.ts`), and for those it records
 * NOTHING. Flutterwave's `verif-hash` is a static string covering none of the
 * body; PayPal's signature needs a call back to PayPal. Accepting either on
 * face value would be inferring money from an unauthenticated source — Rule #3
 * with real consequences, because the amount is attacker-controlled. Those
 * events are acknowledged and parked, and confirming them is the next piece of
 * work; it needs a merchant account to build against.
 *
 * Deploy: supabase functions deploy payment-webhook --no-verify-jwt
 * (--no-verify-jwt because the caller is a payment provider with no account.
 * The signature IS the authorisation.)
 */

// @ts-expect-error — Deno resolves this at deploy time; the app never builds it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { type Credentials, normalise, routeOf, verify } from './rules.ts'

declare const Deno: { env: { get(name: string): string | undefined } }

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  // Service role. Never shipped to a browser.
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

/**
 * Always 200, with a short reason.
 *
 * Providers retry on a non-2xx, so a refusal returning 401 would earn an
 * escalating retry storm for a request that will never become valid. It would
 * also tell whoever is probing exactly which of "wrong company", "no
 * credentials" and "bad signature" they hit — the same leak the public-link
 * function avoids by never varying its status code.
 */
const done = (status: string, detail?: string) =>
  new Response(JSON.stringify({ status, ...(detail === undefined ? {} : { detail }) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return done('ignored', 'not a POST')

  const route = routeOf(new URL(request.url).pathname)
  if (route === null) return done('ignored', 'unknown route')
  const { provider, companyId } = route

  // The RAW text, read once and never re-serialised: Paystack signs the bytes,
  // and JSON.parse followed by JSON.stringify is not the same bytes.
  const rawBody = await request.text()

  const { data: credentialRow } = await admin
    .from('payment_provider_credentials')
    .select('secret, webhook_id')
    .eq('company_id', companyId)
    .eq('provider', provider)
    .maybeSingle()

  const credentials: Credentials = {
    ...(credentialRow?.secret == null ? {} : { secret: String(credentialRow.secret) }),
    ...(credentialRow?.webhook_id == null ? {} : { webhookId: String(credentialRow.webhook_id) }),
  }

  const verdict = await verify(provider, request.headers, rawBody, credentials)
  if (verdict.kind === 'rejected') return done('rejected')
  if (verdict.kind === 'needs_confirmation') {
    // Acknowledged so the provider stops retrying, and NOT recorded. The body
    // is not evidence of money until the provider confirms it out of band.
    return done('unconfirmed', verdict.reason)
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return done('rejected', 'not json')
  }

  const event = normalise(provider, body)
  if (event.kind !== 'payment') return done(event.kind, event.reason)

  const { payment } = event

  // Which invoice this settles, if the merchant reference names one of ours.
  // A miss is not an error: §G forbids inventing an invoice, and §K says
  // unmatched money is customer credit.
  const { data: invoice } = await admin
    .from('documents')
    .select('id, customer_id, total_minor, currency')
    .eq('company_id', companyId)
    .eq('type', 'invoice')
    .eq('issued_reference', payment.reference)
    .maybeSingle()

  // Currencies never mix (Rule #3). An invoice billed in one currency is not
  // settled by money that arrived in another, so that stays customer credit.
  const settles =
    invoice !== null && String(invoice.currency).toUpperCase() === payment.currency.toUpperCase()

  const { data, error } = await admin.rpc('record_provider_payment', {
    p_company_id: companyId,
    p_external_event_id: payment.externalEventId,
    p_customer_id: settles ? (invoice?.customer_id ?? null) : null,
    p_currency: payment.currency,
    p_amount_minor: payment.amountMinor,
    p_paid_at: payment.paidAt,
    p_method: provider,
    p_reference: payment.reference,
    p_invoice_id: settles ? invoice?.id : null,
    p_allocate_minor: null,
  })

  if (error !== null) {
    // A real failure: the provider SHOULD retry, so this is the one path that
    // does not answer 200.
    return new Response(JSON.stringify({ status: 'error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const result = data as { recorded: boolean } | null
  return done(result?.recorded === true ? 'recorded' : 'already recorded')
}

declare const addEventListener: (type: string, handler: (event: unknown) => void) => void
// @ts-expect-error — Deno.serve exists at deploy time.
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  // @ts-expect-error — as above.
  Deno.serve(handler)
}
void addEventListener
