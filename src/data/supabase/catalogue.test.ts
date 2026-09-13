/**
 * The six remaining repositories, asserted on the requests they build.
 *
 * `remember_item` itself is tested against real Postgres in
 * `supabase/tests/catalogue.test.ts` — the atomic count and the
 * case-insensitive match are SQL facts. What is only visible here is the
 * call, and the filters that decide what each list actually contains.
 */

import { describe, expect, it } from 'vitest'

import { harness } from './harness'
import {
  createAssetRepository,
  createCreditNoteRepository,
  createExpenseRepository,
  createItemRepository,
  createLinkTokenRepository,
  createShareEventRepository,
} from './catalogue'
import { money } from '../../domain/money/money'

const ACME = '11111111-1111-1111-1111-111111111111'
const ctx = (idempotencyKey: string) => ({ idempotencyKey })

const itemRow = {
  id: 'itm_1',
  company_id: ACME,
  name: 'Cement',
  times_used: 4,
  last_price_minor: 500_000,
  currency: 'NGN',
}

const shareRow = {
  id: 'shr_1',
  company_id: ACME,
  action: 'shared',
  entity: 'document',
  record_id: 'doc_1',
  at: '2026-09-13T09:00:00Z',
  channel: 'sheet',
}

describe('The catalogue suggests, it does not list (§L2)', () => {
  it('offers nothing at all for an empty prefix', async () => {
    const h = harness([[itemRow]])
    expect(await createItemRepository(h.db).suggest(ACME, '  ')).toEqual([])
    // A suggestion list that fills before a key is pressed is a menu, and
    // §L2 asks for a shortcut. No request is even made.
    expect(h.calls).toHaveLength(0)
  })

  it('matches a PREFIX, not a contains', async () => {
    const h = harness([[itemRow]])
    await createItemRepository(h.db).suggest(ACME, 'ce')

    // `%ce%` would offer "office chair" for "ce". The wildcard goes on one
    // end only.
    expect(h.call(0).params.get('name')).toBe('ilike.ce%')
    expect(h.call(0).params.get('company_id')).toBe(`eq.${ACME}`)
  })

  it('orders by what gets typed most', async () => {
    const h = harness([[itemRow]])
    await createItemRepository(h.db).suggest(ACME, 'ce')
    expect(h.call(0).params.get('order')).toBe('times_used.desc,name.asc')
  })

  it('does not let a typed wildcard widen a suggestion', async () => {
    const h = harness([[itemRow]])
    await createItemRepository(h.db).suggest(ACME, 'c%')
    expect(h.call(0).params.get('name')).toBe('ilike.c %')
  })

  it('remembers through the function, so the count cannot be lost', async () => {
    const h = harness([{ json: { ...itemRow, times_used: 5 } }])
    const remembered = await createItemRepository(h.db).remember(
      { companyId: ACME, name: 'Cement', lastPrice: money('NGN', 500_000) },
      ctx('itm:cement'),
    )

    expect(h.call(0).table).toBe('rpc/remember_item')
    expect(h.call(0).body).toMatchObject({
      p_idempotency_key: 'itm:cement',
      p_item: { name: 'Cement', last_price_minor: 500_000, currency: 'NGN' },
    })
    expect(remembered.timesUsed).toBe(5)
  })
})

describe('A share list contains shares, and nothing else (§M)', () => {
  it('filters the audit log down to the three share actions', async () => {
    const h = harness([[shareRow]])
    await createShareEventRepository(h.db).list(ACME)

    // `audit_log` carries every action a company takes. Unfiltered, a share
    // list would quietly include issues and voids.
    expect(h.call(0).params.get('action')).toBe('in.(shared,share_dismissed,share_failed)')
    expect(h.call(0).params.get('company_id')).toBe(`eq.${ACME}`)
  })

  it('keeps that filter when narrowing to one document', async () => {
    const h = harness([[shareRow]])
    await createShareEventRepository(h.db).listForDocument(ACME, 'doc_1')

    expect(h.call(0).params.get('action')).toBe('in.(shared,share_dismissed,share_failed)')
    expect(h.call(0).params.get('record_id')).toBe('eq.doc_1')
  })

  it('records a handoff once, with the route it took', async () => {
    const h = harness([[shareRow]])
    await createShareEventRepository(h.db).record(
      {
        companyId: ACME,
        action: 'shared',
        entity: 'document',
        recordId: 'doc_1',
        at: '2026-09-13T09:00:00Z',
        channel: 'clipboard',
      },
      ctx('shr:1'),
    )

    expect(h.call(0).method).toBe('POST')
    expect(h.call(0).body).toMatchObject({ action: 'shared', channel: 'clipboard' })
    expect(h.call(0).prefer).toContain('resolution=ignore-duplicates')
  })
})

describe('Append-only means append-only (§E, Rule #5)', () => {
  it('issues a credit note with its own currency beside the amount', async () => {
    const h = harness([[{ id: 'crn_1', company_id: ACME, invoice_id: 'doc_1', currency: 'NGN', amount_minor: 25_000 }]])
    await createCreditNoteRepository(h.db).issue(
      {
        companyId: ACME,
        invoiceId: 'doc_1',
        amount: money('NGN', 25_000),
        reference: 'CN-0001',
        reason: 'Two bags short',
        issuedAt: '2026-09-13T09:00:00Z',
        invoiceReference: 'INV-0007',
        invoiceTotal: money('NGN', 90_000),
      },
      ctx('crn:1'),
    )

    expect(h.call(0).body).toMatchObject({
      currency: 'NGN',
      amount_minor: 25_000,
      invoice_snapshot: { reference: 'INV-0007', totalMinor: 90_000 },
    })
  })

  it('never issues an UPDATE or a DELETE against an asset', async () => {
    const assetRow = { id: 'ast_1', company_id: ACME, kind: 'signature', data_url: 'data:,x' }
    const h = harness([[assetRow], [assetRow], [assetRow]])
    const assets = createAssetRepository(h.db)

    await assets.list(ACME)
    await assets.get('ast_1')
    await assets.store(
      { companyId: ACME, kind: 'signature', dataUrl: 'data:,x', createdAt: '2026-09-13T09:00:00Z' },
      ctx('ast:1'),
    )

    // An asset behind an issued document is evidence (§P): if it could be
    // replaced, every PDF already shared under it would change meaning.
    expect(h.calls.map((c) => c.method)).toEqual(['GET', 'GET', 'POST'])
  })

  it('creates an expense once, however often it is retried', async () => {
    const h = harness([[{ id: 'exp_1', company_id: ACME, description: 'Fuel', currency: 'NGN', amount_minor: 8_000, spent_on: '2026-09-13' }]])
    await createExpenseRepository(h.db).create(
      { companyId: ACME, description: 'Fuel', amount: money('NGN', 8_000), spentOn: '2026-09-13' },
      ctx('exp:1'),
    )

    expect(h.call(0).params.get('on_conflict')).toBe('company_id,idempotency_key')
    expect(h.call(0).body).toMatchObject({ idempotency_key: 'exp:1' })
  })
})

describe('Minting a link kills the one before it (§P)', () => {
  const token = {
    documentId: 'doc_1',
    companyId: ACME,
    tokenHash: 'b'.repeat(64),
    expiresAt: '2026-09-27T00:00:00Z',
  }

  it('upserts on the document, so there is never a second live token', async () => {
    const h = harness([[{ document_id: 'doc_1', company_id: ACME, token_hash: 'b'.repeat(64), expires_at: token.expiresAt }]])
    await createLinkTokenRepository(h.db).mint(token, ctx('lnk:1'))

    expect(h.call(0).method).toBe('POST')
    expect(h.call(0).params.get('on_conflict')).toBe('document_id')
    // NOT ignore-duplicates: this write must REPLACE. Ignoring the conflict
    // would leave the old link alive and the owner believing they revoked it.
    expect(h.call(0).prefer).not.toContain('resolution=ignore-duplicates')
  })

  it('clears the consumed stamp, so the replacement is not born dead', async () => {
    const h = harness([[{ document_id: 'doc_1', company_id: ACME, token_hash: 'b'.repeat(64), expires_at: token.expiresAt }]])
    await createLinkTokenRepository(h.db).mint(token, ctx('lnk:2'))
    expect(h.call(0).body).toMatchObject({ consumed_at: null })
  })

  it('stores only the hash, never the token', async () => {
    const h = harness([[{ document_id: 'doc_1', company_id: ACME, token_hash: 'b'.repeat(64), expires_at: token.expiresAt }]])
    await createLinkTokenRepository(h.db).mint(token, ctx('lnk:3'))
    expect(JSON.stringify(h.call(0).body)).not.toContain('GOODTOKEN')
    expect(h.call(0).body).toMatchObject({ token_hash: 'b'.repeat(64) })
  })
})
