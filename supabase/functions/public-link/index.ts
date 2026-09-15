/**
 * The public link endpoint (§P, §Q Phase 5).
 *
 * The ONE place a stranger's phone may read a document. It exists because the
 * alternative does not work: a customer is not signed in, and RLS scopes every
 * read to a company (§P), so there is no anon-key query that could serve this
 * without opening every other company's documents at the same time.
 *
 * Service-role runs here and NOWHERE else. CLAUDE.md: the client never writes
 * entitlements and never holds this key; §P: the token hash lives in a table
 * with no client policy. Both hold because this function is the only reader.
 *
 * Two verbs:
 *   GET  ?token=…  → the minimal view, or a refusal
 *   POST ?token=…  → the answer or the signature, then the token dies
 *
 * The decisions live in `rules.ts`, which the app's own test suite imports and
 * pins against the client's copy — two runtimes, one set of rules, and a test
 * that fails if they diverge.
 *
 * Deploy: supabase functions deploy public-link --no-verify-jwt
 * (--no-verify-jwt is the point: the caller is a customer with no account.
 * The token IS the authorisation, which is why it is 32 random bytes and why
 * only its hash is ever stored.)
 */

// @ts-expect-error — Deno resolves this at deploy time; the app never builds it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { CALLER_BUCKET, TOKEN_BUCKET, callerKey, overLimit } from '../_shared/ratelimit.ts'
import {
  type DocumentRow,
  type Refusal,
  type WriteRequest,
  checkRow,
  hashToken,
  planFor,
  viewFor,
} from './rules.ts'

declare const Deno: { env: { get(name: string): string | undefined } }

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  // Service role. Never shipped to a browser; see the header note.
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
)

/**
 * Wide open BY DESIGN, and only this function.
 *
 * The recipient of a link has no account and may open it from anywhere — an
 * email client, a WhatsApp webview, a desktop browser — so an origin
 * allowlist here would have to be a list of every place a customer might be.
 * What protects this endpoint is the token and the rules in `rules.ts`, never
 * the caller's origin.
 *
 * The three below are not about CORS. They are headers any response should
 * carry, and this one especially: it is the single surface a stranger can
 * reach, so a MIME sniff or a leaked token costs more here than anywhere else
 * in the product.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  // Never let a browser decide this JSON is something executable.
  'x-content-type-options': 'nosniff',
  // The link token is in the URL. It must not travel in a Referer.
  'referrer-policy': 'no-referrer',
  // Nothing here is worth keeping: a token's answer changes when it is used,
  // and a cached "ok" is a revoked link still working.
  'cache-control': 'no-store',
}

/**
 * Every refusal is a 200 with a reason.
 *
 * A 404 for "wrong" and a 410 for "expired" would tell whoever is guessing
 * which of the two they hit — the status code leaking what §P spent a table
 * on hiding.
 */
const refuse = (reason: Refusal): Response =>
  new Response(JSON.stringify({ ok: false, reason }), {
    status: 200,
    headers: { ...CORS, 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow' },
  })

const ok = (body: unknown): Response =>
  new Response(JSON.stringify({ ok: true, ...(body as object) }), {
    status: 200,
    headers: { ...CORS, 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow' },
  })

/** The row, joined to the names the page prints. Read with service role. */
async function loadDocument(documentId: string): Promise<DocumentRow | null> {
  const { data } = await admin
    .from('documents')
    .select(
      'id, type, status, issued_reference, frozen_labels, currency, total_minor, line_items, issue_date, valid_until, delivery_address, customers(name), companies(name)',
    )
    .eq('id', documentId)
    .maybeSingle()

  if (data === null || data === undefined) return null
  const row = data as Record<string, unknown>
  return {
    ...(row as unknown as DocumentRow),
    customer_name: (row['customers'] as { name?: string } | null)?.name ?? null,
    business_name: (row['companies'] as { name?: string } | null)?.name ?? null,
  }
}

Deno.serve?.(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!/^[0-9A-Z]{16,64}$/.test(token)) return refuse('wrong')

  const now = new Date()
  const tokenHash = await hashToken(token)
  const caller = callerKey(request.headers.get('x-forwarded-for'))

  // Both buckets are charged BEFORE either decides. Returning on the first
  // one over would hide a run against a single token from the per-caller
  // bucket, and the per-caller bucket is the one that sees a guessing run at
  // all. `overLimit` hashes what it is given, so the key the database stores
  // for this bucket is exactly `tokenHash` — never the token (§P).
  const charged = await Promise.all([
    overLimit(admin, TOKEN_BUCKET, token),
    caller === null ? Promise.resolve(false) : overLimit(admin, CALLER_BUCKET, caller),
  ])
  if (charged.some(Boolean)) return refuse('rate_limited')

  // Looked up BY HASH: the token itself never reaches the database, so a
  // query log cannot be replayed into a working link (§P).
  const { data: row } = await admin
    .from('document_signing_tokens')
    .select('document_id, token_hash, expires_at, consumed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  const refusal = await checkRow(row ?? null, token, now)
  if (refusal !== null) return refuse(refusal)

  const document = await loadDocument((row as { document_id: string }).document_id)
  if (document === null) return refuse('wrong')

  if (request.method === 'GET') {
    const view = viewFor(document)
    return typeof view === 'string' ? refuse(view) : ok({ view })
  }

  if (request.method !== 'POST') return refuse('wrong')

  const body = (await request.json().catch(() => ({}))) as WriteRequest
  const plan = planFor(document, body, now.toISOString())
  if (typeof plan === 'string') return refuse(plan)

  // The signature first: a document may only ever name an asset that exists
  // (§P), the same order the owner's own phone uses.
  let signatureAssetId: string | null = null
  if (plan.needsSignatureAsset && body.signatureDataUrl !== undefined) {
    const { data: asset } = await admin
      .from('assets')
      .insert({
        company_id: (document as unknown as { company_id: string }).company_id,
        kind: document.type === 'waybill' ? 'delivery_photo' : 'signature',
        data_url: body.signatureDataUrl,
      })
      .select('id')
      .single()
    signatureAssetId = (asset as { id: string } | null)?.id ?? null
  }

  // §Q: "atomic delivered + timestamp, token invalidated". One RPC, so the
  // evidence and the dead token land together or not at all — two statements
  // could leave a signed document with a live link, which is the single
  // thing §P forbids.
  const { error } = await admin.rpc('apply_public_link', {
    p_document_id: plan.documentId,
    p_status: plan.status,
    p_signer_name: plan.signerName ?? null,
    p_signer_role: plan.signerRole ?? null,
    p_signed_at: plan.signedAt ?? null,
    p_signature_asset_id: signatureAssetId,
    p_token_hash: (row as { token_hash: string }).token_hash,
    p_consumed_at: now.toISOString(),
  })
  if (error !== null) return refuse('not_answerable')

  return ok({ done: plan.status })
})
