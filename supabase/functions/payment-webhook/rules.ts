/**
 * Provider payment webhooks — the decisions, with no I/O (§Q Phase 5, §271).
 *
 * §271: "provider-backed payments are confirmed only by a verified, idempotent
 * provider event." §Q's gate: "a confirmed provider event records exactly one
 * payment."
 *
 * The single most important thing in this file is that **the three providers
 * do not offer the same guarantee**, and treating them alike would accept
 * forged money from two of them:
 *
 *  · **Paystack** signs the RAW BODY: `x-paystack-signature` is a hex
 *    HMAC-SHA512 keyed with the merchant's secret key. A valid signature
 *    proves this exact body came from Paystack. Self-contained, offline,
 *    strong.
 *  · **Flutterwave** does NOT sign anything. `verif-hash` is a STATIC string
 *    the merchant sets in their dashboard, identical on every request,
 *    computed over nothing. It proves the sender knows a shared secret. It
 *    says nothing whatsoever about the body — so anyone who has ever seen one
 *    request (a log, a proxy, a previous delivery) can post any body they like
 *    with the same header.
 *  · **PayPal** signs with a certificate chain, verified either by validating
 *    that chain or by posting the event back to PayPal's
 *    `verify-webhook-signature` endpoint. Either way it cannot be settled from
 *    the request alone.
 *
 * So this file returns a VERDICT, not a boolean, and two of the three verdicts
 * are `needs_confirmation` — the body is not yet evidence of money. Recording a
 * payment on a Flutterwave body alone would be inferring money from an
 * unauthenticated source, which is Rule #3 with the consequences spelled out.
 *
 * None of this has been exercised against a real provider. That needs a
 * merchant account, which is not something this build can create.
 */

/** What the three providers are called, internally and in a URL. */
export const PROVIDERS = ['paystack', 'flutterwave', 'paypal'] as const
export type Provider = (typeof PROVIDERS)[number]

export const isProvider = (value: string): value is Provider =>
  (PROVIDERS as readonly string[]).includes(value)

export interface Route {
  readonly provider: Provider
  readonly companyId: string
}

/**
 * `/payment-webhook/:provider/:companyId`.
 *
 * The company is in the PATH because nothing in a provider's charge says which
 * DocFlow company it belongs to — we did not create the charge; the merchant
 * pointed their own dashboard at this URL. The id selects WHICH secret to check
 * against and is not itself authority: knowing it buys nothing without a
 * signature, exactly as a document id buys nothing without a link token.
 */
export function routeOf(pathname: string): Route | null {
  const parts = pathname.split('/').filter((part) => part !== '')
  const companyId = parts.pop() ?? ''
  const provider = parts.pop() ?? ''
  return isProvider(provider) && companyId !== '' ? { provider, companyId } : null
}

export type Verdict =
  /** The body is proven to have come from the provider. Money may be recorded. */
  | { readonly kind: 'authentic' }
  /**
   * The request carries what the provider sends, but the body is not proven.
   * A second, authenticated call to the provider must confirm the transaction
   * before a single minor unit is written.
   */
  | { readonly kind: 'needs_confirmation'; readonly reason: string }
  | { readonly kind: 'rejected'; readonly reason: string }

/** Constant time, so a wrong signature cannot be discovered one byte at a time. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}

export async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface Credentials {
  /** Paystack: the merchant secret key. Flutterwave: the dashboard secret hash. */
  readonly secret?: string
  /** PayPal: the configured webhook id, needed for its verification call. */
  readonly webhookId?: string
}

/**
 * Is this request what it claims to be?
 *
 * Takes the RAW body text, never a parsed object: Paystack signs the bytes, and
 * re-serialising a parsed body changes them (key order, whitespace, unicode
 * escapes), so a valid request would fail and an attacker's would not be the
 * thing checked.
 */
export async function verify(
  provider: Provider,
  headers: Headers,
  rawBody: string,
  credentials: Credentials,
): Promise<Verdict> {
  switch (provider) {
    case 'paystack': {
      const signature = headers.get('x-paystack-signature')
      if (signature === null) return { kind: 'rejected', reason: 'no signature' }
      if (credentials.secret === undefined || credentials.secret === '') {
        return { kind: 'rejected', reason: 'no secret configured' }
      }
      const expected = await hmacSha512Hex(credentials.secret, rawBody)
      return sameSecret(signature.toLowerCase(), expected)
        ? { kind: 'authentic' }
        : { kind: 'rejected', reason: 'signature does not match' }
    }

    case 'flutterwave': {
      const hash = headers.get('verif-hash')
      if (hash === null) return { kind: 'rejected', reason: 'no verif-hash' }
      if (credentials.secret === undefined || credentials.secret === '') {
        return { kind: 'rejected', reason: 'no secret hash configured' }
      }
      if (!sameSecret(hash, credentials.secret)) {
        return { kind: 'rejected', reason: 'verif-hash does not match' }
      }
      // Matching proves only that the sender knows the shared secret. The
      // header is the same on every request and covers none of the body, so
      // the amount, the currency and the reference are all still unproven.
      return {
        kind: 'needs_confirmation',
        reason: 'verif-hash is a static shared secret and does not sign the body',
      }
    }

    case 'paypal': {
      // Every header PayPal's verification call requires. Their absence is a
      // rejection; their presence is not yet a proof.
      const required = [
        'paypal-auth-algo',
        'paypal-cert-url',
        'paypal-transmission-id',
        'paypal-transmission-sig',
        'paypal-transmission-time',
      ]
      const missing = required.filter((name) => headers.get(name) === null)
      if (missing.length > 0) {
        return { kind: 'rejected', reason: `missing ${missing.join(', ')}` }
      }
      if (credentials.webhookId === undefined || credentials.webhookId === '') {
        return { kind: 'rejected', reason: 'no webhook id configured' }
      }
      return {
        kind: 'needs_confirmation',
        reason: 'PayPal signatures are verified by a call to PayPal, not from the request',
      }
    }
  }
}

/**
 * A decimal amount in MAJOR units, as an exact count of minor units.
 *
 * Paystack sends minor units already; Flutterwave and PayPal send major units
 * ("500", "500.10", 500.1).
 *
 * The obvious `Math.round(Number(text) * scale)` is not wrong the way that
 * claim is usually made — `Math.round` does recover 500.10 and every other
 * ordinary amount, and a search over four million of them finds no divergence.
 * It is wrong for three narrower reasons, and each one loses money quietly:
 *
 *  · **`Number()` accepts things that are not amounts.** `Number('')` is 0,
 *    `Number(' ')` is 0, `Number('0x10')` is 16 and `Number('5e2')` is 500. A
 *    missing amount becoming ZERO money is the worst of these: the payment
 *    records, the invoice does not settle, and nothing anywhere says why.
 *  · **More precision than the currency has gets silently rounded away.**
 *    `Math.round(1.005 * 100)` is 100, not 101 — binary cannot hold 1.005, and
 *    here the rounding does NOT recover. Refusing is the only safe answer; a
 *    provider sending three decimals for a two-decimal currency is doing
 *    something this code does not understand.
 *  · **It depends on `Math.round` specifically.** Someone later writing
 *    `Math.floor` or `| 0` breaks it with no test noticing, because the
 *    ordinary amounts still pass.
 *
 * So the string is split on the decimal point and the digits are counted. No
 * float is constructed at any point, and anything that is not a plain decimal
 * is refused rather than coerced (Rule #3).
 */
export function minorFromDecimal(text: string | number, scale: number): number | null {
  const raw = typeof text === 'number' ? String(text) : text.trim()
  // A plain decimal only. Exponent notation is refused rather than guessed at:
  // money that arrives as "5e2" is a provider doing something unexpected, and
  // a wrong guess here is a wrong amount recorded.
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw)
  if (match === null) return null

  const [, sign, whole, fraction = ''] = match
  const digits = String(Math.round(Math.log10(scale)))
  const places = Number(digits)
  if (!Number.isInteger(places) || places < 0) return null

  // Pad or refuse. Truncating "500.999" to two places would silently discard
  // someone's money, so more precision than the currency has is refused.
  if (fraction.length > places) return null
  const padded = fraction.padEnd(places, '0')

  const minor = Number(`${whole}${padded}`)
  if (!Number.isSafeInteger(minor)) return null
  return sign === '-' ? -minor : minor
}

/*
 * ------------------------------------------------------------------
 * Provider events, in the ledger's terms (§K, §M, Rule #3).
 *
 * Three providers describe the same fact — money arrived — in three shapes,
 * and the differences are exactly where money gets lost:
 *
 *  · **Amounts.** Paystack sends MINOR units (kobo). Flutterwave and PayPal
 *    send MAJOR units, as a decimal. Treating them alike is a hundredfold
 *    error in either direction, and it looks perfectly plausible in a log.
 *  · **Identity.** What makes an event "the same event" on a redelivery.
 *  · **Success.** Every provider has its own word for it, and the words that
 *    are NOT success matter as much: a pending or failed charge that recorded
 *    a payment would show an invoice settled by money that never arrived.
 */
export interface ProviderPayment {
  /**
   * The idempotency handle, stored as `payments.external_event_id` (§E).
   *
   * The TRANSACTION id, not the event id, and namespaced by provider. The
   * transaction is the money; the event is one telling of it. Two different
   * events about one successful charge — a redelivery, or a provider sending
   * both a charge and a settlement notice — must still record one payment.
   * Keying on the event id would record two.
   */
  readonly externalEventId: string
  /** The merchant's own reference, which may name one of our documents. */
  readonly reference: string
  readonly currency: string
  readonly amountMinor: number
  readonly paidAt: string
  readonly customerEmail?: string
}

export type Normalised =
  | { readonly kind: 'payment'; readonly payment: ProviderPayment }
  /** A real event that is not money arriving. Acknowledged, never recorded. */
  | { readonly kind: 'ignored'; readonly reason: string }
  | { readonly kind: 'malformed'; readonly reason: string }

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/** Minor units per major unit. Kept here because a webhook has no locale. */
const SCALE: Readonly<Record<string, number>> = {
  NGN: 100, GHS: 100, KES: 100, ZAR: 100, USD: 100, EUR: 100, GBP: 100,
  // Zero-decimal currencies: a "major unit" IS the minor unit.
  JPY: 1, XOF: 1, XAF: 1, RWF: 1, UGX: 1,
}

export function normalise(provider: Provider, body: unknown): Normalised {
  const event = asRecord(body)

  switch (provider) {
    case 'paystack': {
      const name = text(event['event'])
      if (name !== 'charge.success') {
        return { kind: 'ignored', reason: `paystack ${name ?? 'event'} is not a completed charge` }
      }
      const data = asRecord(event['data'])
      if (text(data['status']) !== 'success') {
        return { kind: 'ignored', reason: 'paystack charge did not succeed' }
      }
      const amount = data['amount']
      if (typeof amount !== 'number' || !Number.isInteger(amount)) {
        // Paystack sends an integer count of minor units. Anything else is
        // not a shape this understands, and guessing at money is the one
        // thing Rule #3 forbids outright.
        return { kind: 'malformed', reason: 'paystack amount is not an integer' }
      }
      const id = data['id']
      const transaction = text(String(id ?? ''))
      const currency = text(data['currency'])
      const reference = text(data['reference'])
      if (transaction === undefined || currency === undefined || reference === undefined) {
        return { kind: 'malformed', reason: 'paystack charge is missing id, currency or reference' }
      }
      return {
        kind: 'payment',
        payment: {
          externalEventId: `paystack:${transaction}`,
          reference,
          currency,
          // Already minor units. NOT multiplied — the single most expensive
          // line to get wrong in this file.
          amountMinor: amount,
          paidAt: text(data['paid_at']) ?? text(data['paidAt']) ?? new Date().toISOString(),
          ...emailOf(data),
        },
      }
    }

    case 'flutterwave': {
      const name = text(event['event'])
      if (name !== 'charge.completed') {
        return { kind: 'ignored', reason: `flutterwave ${name ?? 'event'} is not a completed charge` }
      }
      const data = asRecord(event['data'])
      if (text(data['status']) !== 'successful') {
        return { kind: 'ignored', reason: 'flutterwave charge did not succeed' }
      }
      const currency = text(data['currency'])
      const reference = text(data['tx_ref'])
      const transaction = text(String(data['id'] ?? ''))
      if (currency === undefined || reference === undefined || transaction === undefined) {
        return { kind: 'malformed', reason: 'flutterwave charge is missing id, currency or tx_ref' }
      }
      const scale = SCALE[currency.toUpperCase()]
      if (scale === undefined) {
        // Refused rather than assumed to be 100. A zero-decimal currency
        // scaled by 100 records a hundred times the money that arrived.
        return { kind: 'malformed', reason: `unknown minor units for ${currency}` }
      }
      const amountMinor = minorFromDecimal(data['amount'] as string | number, scale)
      if (amountMinor === null) {
        return { kind: 'malformed', reason: 'flutterwave amount is not a plain decimal' }
      }
      return {
        kind: 'payment',
        payment: {
          externalEventId: `flutterwave:${transaction}`,
          reference,
          currency,
          amountMinor,
          paidAt: text(data['created_at']) ?? new Date().toISOString(),
          ...emailOf(data),
        },
      }
    }

    case 'paypal': {
      const name = text(event['event_type'])
      if (name !== 'PAYMENT.CAPTURE.COMPLETED') {
        return { kind: 'ignored', reason: `paypal ${name ?? 'event'} is not a completed capture` }
      }
      const resource = asRecord(event['resource'])
      if (text(resource['status']) !== 'COMPLETED') {
        return { kind: 'ignored', reason: 'paypal capture is not complete' }
      }
      const amount = asRecord(resource['amount'])
      const currency = text(amount['currency_code'])
      const transaction = text(resource['id'])
      if (currency === undefined || transaction === undefined) {
        return { kind: 'malformed', reason: 'paypal capture is missing id or currency' }
      }
      const scale = SCALE[currency.toUpperCase()]
      if (scale === undefined) {
        return { kind: 'malformed', reason: `unknown minor units for ${currency}` }
      }
      const amountMinor = minorFromDecimal(text(amount['value']) ?? '', scale)
      if (amountMinor === null) {
        return { kind: 'malformed', reason: 'paypal amount is not a plain decimal' }
      }
      return {
        kind: 'payment',
        payment: {
          externalEventId: `paypal:${transaction}`,
          // PayPal's merchant reference, when the seller set one.
          reference: text(resource['custom_id']) ?? text(resource['invoice_id']) ?? transaction,
          currency,
          amountMinor,
          paidAt: text(resource['create_time']) ?? new Date().toISOString(),
        },
      }
    }
  }
}

function emailOf(data: Record<string, unknown>): { customerEmail?: string } {
  const email = text(asRecord(data['customer'])['email'])
  return email === undefined ? {} : { customerEmail: email }
}
