/**
 * The edge function's rules, pinned against the client's (§P, §Q).
 *
 * `supabase/functions/public-link/rules.ts` and `src/features/links/token.ts`
 * are two implementations of the same judgement, in two runtimes, because one
 * has service-role access and the other has none. Two implementations drift,
 * and the one nobody watches — the server — drifts first.
 *
 * So this file imports both and asserts they agree. It is the only reason the
 * edge rules were split out of the Deno entry point at all.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  CALLER_BUCKET,
  TOKEN_BUCKET,
  callerKey,
} from '../../../supabase/functions/_shared/ratelimit'
import {
  type DocumentRow,
  type TokenRow,
  checkRow,
  hashToken as edgeHash,
  kindFor as edgeKindFor,
  planFor,
  viewFor,
} from '../../../supabase/functions/public-link/rules'
import {
  type StoredToken,
  checkToken,
  expiryFrom,
  hashToken as clientHash,
  linkKindFor,
  mintToken,
} from './token'

const NOW = new Date('2026-09-13T10:00:00Z')

describe('The two runtimes hash identically (§P)', () => {
  it('agrees on known vectors', async () => {
    expect(await edgeHash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('agrees with the client on anything', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 64 }), async (value) => {
        return (await edgeHash(value)) === (await clientHash(value))
      }),
    )
  })

  it('agrees on a token the client actually minted', async () => {
    const { token, tokenHash } = await mintToken(NOW)
    expect(await edgeHash(token)).toBe(tokenHash)
  })
})

describe('The two runtimes refuse identically (§P)', () => {
  const both = async (
    over: { expiresAt?: string; consumedAt?: string | null } = {},
    token = 'GOODTOKEN',
  ) => {
    const hash = await clientHash('GOODTOKEN')
    const expiresAt = over.expiresAt ?? expiryFrom(NOW)
    const consumedAt = over.consumedAt ?? null

    const client: StoredToken = {
      documentId: 'doc_1',
      tokenHash: hash,
      expiresAt,
      ...(consumedAt === null ? {} : { consumedAt }),
    }
    const edge: TokenRow = {
      document_id: 'doc_1',
      token_hash: hash,
      expires_at: expiresAt,
      consumed_at: consumedAt,
    }
    return {
      client: await checkToken(client, token, NOW),
      edge: await checkRow(edge, token, NOW),
    }
  }

  it('agrees a good token is good', async () => {
    const { client, edge } = await both()
    expect(client).toBeNull()
    expect(edge).toBeNull()
  })

  it('agrees on a wrong token', async () => {
    const { client, edge } = await both({}, 'WRONGTOKEN')
    expect(client).toBe('wrong')
    expect(edge).toBe(client)
  })

  it('agrees on an expired one', async () => {
    const { client, edge } = await both({ expiresAt: '2026-09-01T00:00:00Z' })
    expect(client).toBe('expired')
    expect(edge).toBe(client)
  })

  it('agrees on a used one', async () => {
    const { client, edge } = await both({ consumedAt: '2026-09-12T00:00:00Z' })
    expect(client).toBe('used')
    expect(edge).toBe(client)
  })

  it('agrees that an unknown token is indistinguishable from a wrong one', async () => {
    expect(await checkToken(null, 'ANY', NOW)).toBe('wrong')
    expect(await checkRow(null, 'ANY', NOW)).toBe('wrong')
  })

  it('agrees which documents a link is for', () => {
    for (const [type, status] of [
      ['quotation', 'issued'],
      ['quotation', 'sent'],
      ['quotation', 'accepted'],
      ['quotation', 'draft'],
      ['waybill', 'dispatched'],
      ['waybill', 'in_transit'],
      ['waybill', 'delivered'],
      ['invoice', 'issued'],
      ['receipt', 'issued'],
    ] as const) {
      expect(edgeKindFor(type, status)).toBe(linkKindFor(type, status))
    }
  })
})

const quotation: DocumentRow = {
  id: 'doc_q',
  type: 'quotation',
  status: 'sent',
  issued_reference: 'QUO-0009',
  frozen_labels: {
    printedTitle: 'QUOTATION',
    partyLabel: 'Client',
    signatureCaption: 'PREPARED BY',
    language: 'en',
  },
  currency: 'NGN',
  total_minor: 100_000_00,
  line_items: [{ description: 'Bag of cement', quantityMilli: 20_000, unitPriceMinor: 5_000_00 }],
  issue_date: '2026-09-01',
  valid_until: '2026-09-30',
  delivery_address: null,
  customer_name: 'Ade Stores',
  business_name: 'Sola Ventures',
}

const delivery: DocumentRow = {
  ...quotation,
  id: 'doc_w',
  type: 'waybill',
  status: 'dispatched',
  issued_reference: 'WAY-0007',
  frozen_labels: {
    printedTitle: 'WAYBILL',
    partyLabel: 'Deliver to',
    signatureCaption: 'RECEIVED BY',
    language: 'en',
  },
  total_minor: 0,
  line_items: [{ description: '40 bags of cement', quantityMilli: 40_000 }],
  valid_until: null,
  delivery_address: '14 Adeola Odeku, Victoria Island',
}

describe('What crosses the wire is the minimum (§P)', () => {
  it('sends what the customer needs to answer, in the frozen language', () => {
    const view = viewFor(quotation)
    expect(view).not.toBe('not_answerable')
    if (typeof view === 'string') return
    expect(view.kind).toBe('accept')
    expect(view.reference).toBe('QUO-0009')
    expect(view.language).toBe('en')
    expect(view.customerName).toBe('Ade Stores')
    expect(view.total).toEqual({ currency: 'NGN', minor: 100_000_00 })
  })

  it('sends no money at all on a delivery (§V)', () => {
    const view = viewFor(delivery)
    if (typeof view === 'string') throw new Error('expected a view')
    expect(view.total).toBeUndefined()
    // Not even on the lines: a price there would put money on a document
    // that carries none.
    expect(view.lines[0]).not.toHaveProperty('unitPriceMinor')
    expect(JSON.stringify(view)).not.toContain('500000')
  })

  it('sends nothing about the company beyond the name on the document', () => {
    const view = viewFor(quotation)
    if (typeof view === 'string') throw new Error('expected a view')
    expect(Object.keys(view).sort()).toEqual([
      'businessName',
      'customerName',
      'deliveryAddress',
      'issueDate',
      'kind',
      'language',
      'lines',
      'partyLabel',
      'reference',
      'title',
      'total',
      'validUntil',
    ])
  })

  it('refuses a document whose moment has passed', () => {
    // The link was real; there is nothing left to do. Saying so leaks nothing
    // the holder of the token does not already know.
    expect(viewFor({ ...quotation, status: 'accepted' })).toBe('not_answerable')
    expect(viewFor({ ...delivery, status: 'delivered' })).toBe('not_answerable')
  })
})

describe('What a submitted answer does (§Q)', () => {
  it('accepts a quotation, with the signature optional', () => {
    const plan = planFor(quotation, { answer: 'accepted' }, '2026-09-13T10:00:00Z')
    if (typeof plan === 'string') throw new Error('expected a plan')
    expect(plan.status).toBe('accepted')
    expect(plan.needsSignatureAsset).toBe(false)
    expect(plan.signedAt).toBe('2026-09-13T10:00:00Z')
  })

  it('records a signature on an acceptance when one was drawn', () => {
    const plan = planFor(
      quotation,
      { answer: 'accepted', signerName: 'Ade', signatureDataUrl: 'data:image/svg+xml,x' },
      '2026-09-13T10:00:00Z',
    )
    if (typeof plan === 'string') throw new Error('expected a plan')
    expect(plan.needsSignatureAsset).toBe(true)
    expect(plan.signerName).toBe('Ade')
  })

  it('turns a quotation down', () => {
    const plan = planFor(quotation, { answer: 'rejected' }, '2026-09-13T10:00:00Z')
    if (typeof plan === 'string') throw new Error('expected a plan')
    expect(plan.status).toBe('rejected')
  })

  it('refuses an answer that is neither', () => {
    expect(planFor(quotation, {}, '2026-09-13T10:00:00Z')).toBe('not_answerable')
    expect(
      planFor(quotation, { answer: 'delivered' as never }, '2026-09-13T10:00:00Z'),
    ).toBe('not_answerable')
  })

  it('requires BOTH a name and a mark on a delivery (§P)', () => {
    const at = '2026-09-13T10:00:00Z'
    expect(planFor(delivery, { signerName: 'Bisi' }, at)).toBe('not_answerable')
    expect(planFor(delivery, { signatureDataUrl: 'data:image/svg+xml,x' }, at)).toBe(
      'not_answerable',
    )
    expect(planFor(delivery, { signerName: '   ', signatureDataUrl: 'x' }, at)).toBe(
      'not_answerable',
    )

    const plan = planFor(
      delivery,
      { signerName: '  Bisi Adeyemi ', signerRole: ' Storekeeper ', signatureDataUrl: 'x' },
      at,
    )
    if (typeof plan === 'string') throw new Error('expected a plan')
    expect(plan.status).toBe('delivered')
    expect(plan.signerName).toBe('Bisi Adeyemi')
    expect(plan.signerRole).toBe('Storekeeper')
  })

  it('refuses anything on a document that is not answerable', () => {
    expect(
      planFor({ ...quotation, status: 'void' }, { answer: 'accepted' }, '2026-09-13T10:00:00Z'),
    ).toBe('not_answerable')
  })
})

describe('Guessing is throttled by a limiter that is actually shared (§P)', () => {
  it('takes the caller from the first hop, which the client cannot forge ahead of', () => {
    expect(callerKey('41.58.1.9, 10.0.0.2, 10.0.0.3')).toBe('41.58.1.9')
    expect(callerKey('  41.58.1.9  ')).toBe('41.58.1.9')
  })

  it('skips the per-caller bucket rather than sharing one "unknown" key', () => {
    // A shared key would let one script spend the budget every anonymous
    // caller draws from — a lockout built out of a limiter.
    expect(callerKey(null)).toBeNull()
    expect(callerKey('')).toBeNull()
    expect(callerKey(' , 10.0.0.2')).toBeNull()
  })

  it('gives the two buckets separate names, so they never share a budget', () => {
    expect(TOKEN_BUCKET.bucket).not.toBe(CALLER_BUCKET.bucket)
  })

  it('leaves room for a customer reloading their own link', () => {
    // Whatever the numbers become, a person opening a link a few times must
    // be nowhere near either ceiling.
    expect(TOKEN_BUCKET.limit).toBeGreaterThanOrEqual(10)
    expect(CALLER_BUCKET.limit).toBeGreaterThan(TOKEN_BUCKET.limit)
  })

  it('counts in Postgres, not in a Map the next instance cannot see', () => {
    // The old limiter was module-scope state. This asserts against the entry
    // point itself, because a limiter that is correct in `rules.ts` and
    // unused in `index.ts` limits nothing.
    const entry = readFileSync(
      resolve(process.cwd(), 'supabase/functions/public-link/index.ts'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')

    expect(entry).toMatch(/overLimit\(admin, TOKEN_BUCKET/)
    expect(entry).toMatch(/from '\.\.\/_shared\/ratelimit\.ts'/)
    expect(entry).not.toMatch(/new Map\b/)

    // …and the shared module is the one that reaches the shared counter.
    const shared = readFileSync(
      resolve(process.cwd(), 'supabase/functions/_shared/ratelimit.ts'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
    expect(shared).toContain("rpc('check_rate_limit'")
  })
})
