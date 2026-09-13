/**
 * The repository contracts. These tests run against the in-memory
 * implementation, but they assert CONTRACT behaviour — every implementation
 * (SQLite in Phase 2/3, Supabase in Phase 5) must pass the same suite, so a
 * caller never discovers a rule only once it reaches a real database.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  type MemoryState,
  type Repositories,
  RepositoryError,
  createMemoryRepositories,
  emptyState,
} from './index'
import { freezeLabels } from '../../domain/locale/profile'
import { money } from '../../domain/money/money'
import { quantity } from '../../domain/documents/types'

const ACME = 'co_acme'
const RIVAL = 'co_rival'

let state: MemoryState
let repos: Repositories

const ctx = (key: string) => ({ idempotencyKey: key })

beforeEach(() => {
  state = emptyState()
  for (const id of [ACME, RIVAL]) {
    state.companies.push({
      id,
      name: id,
      localeRegion: 'NG',
      localeLanguage: 'en',
      labelOverrides: {},
      currency: 'NGN',
      numberingPrefixes: {},
      bankFields: {},
      enabledPaymentMethods: [],
    })
  }
  repos = createMemoryRepositories(state)
})

const draft = (companyId = ACME) => ({
  companyId,
  type: 'invoice' as const,
  status: 'draft',
  currency: 'NGN',
  lineItems: [
    { id: 'l1', description: 'Cement', quantityMilli: quantity(3), unitPriceMinor: 500_000, taxable: true },
  ],
  totalMinor: 1_500_000,
})

describe('Every mutation is idempotent (§M)', () => {
  it('returns the same record when a create is replayed', async () => {
    const first = await repos.customers.create(
      { companyId: ACME, kind: 'person', name: 'Okoro', labels: [] },
      ctx('k1'),
    )
    const replayed = await repos.customers.create(
      { companyId: ACME, kind: 'person', name: 'Okoro', labels: [] },
      ctx('k1'),
    )

    expect(replayed).toBe(first)
    expect(await repos.customers.list(ACME)).toHaveLength(1)
  })

  it('does not merge two genuinely different mutations', async () => {
    await repos.customers.create({ companyId: ACME, kind: 'person', name: 'A', labels: [] }, ctx('k1'))
    await repos.customers.create({ companyId: ACME, kind: 'person', name: 'B', labels: [] }, ctx('k2'))
    expect(await repos.customers.list(ACME)).toHaveLength(2)
  })

  it('records a payment once however often it is replayed', async () => {
    const payment = {
      customerId: 'cus_1',
      amount: money('NGN', 50_000_00),
      paidAt: '2026-09-11T10:00:00Z',
      method: 'bank_transfer',
      source: 'manual' as const,
      allocations: [],
    }
    for (const _ of [1, 2, 3]) await repos.payments.record(payment, ctx('pay-key'))
    expect(state.payments).toHaveLength(1)
  })

  it('stamps the allocations with the id it minted, not the caller handle', async () => {
    // A caller builds allocations against a local handle, because the real id
    // does not exist until this write. An allocation left naming that handle
    // points at a payment that is not there — invisible in memory, a broken
    // foreign key the moment this is SQLite (§E).
    const recorded = await repos.payments.record(
      {
        customerId: 'cus_1',
        amount: money('NGN', 50_000_00),
        paidAt: '2026-09-11T10:00:00Z',
        method: 'bank_transfer',
        source: 'manual' as const,
        allocations: [
          {
            id: 'local:doc_inv',
            paymentId: 'local',
            invoiceId: 'doc_inv',
            amount: money('NGN', 50_000_00),
          },
        ],
      },
      ctx('pay-stamp'),
    )

    expect(recorded.id).not.toBe('local')
    expect(recorded.allocations[0]?.paymentId).toBe(recorded.id)
    expect(recorded.allocations[0]?.id).toBe(`${recorded.id}:doc_inv`)
    // And the money is untouched by the re-stamping.
    expect(recorded.allocations[0]?.amount).toEqual(money('NGN', 50_000_00))
    expect(recorded.allocations[0]?.invoiceId).toBe('doc_inv')
  })
})

describe('Issued documents are immutable (Rule #5, §C)', () => {
  it('refuses to edit a document once issued', async () => {
    const created = await repos.documents.createDraft(draft(), ctx('d1'))
    const issued = await repos.documents.issue(
      created.id,
      {
        reference: 'INV-0001',
        frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'invoice'),
        totalMinor: 1_500_000,
      },
      ctx('d1-issue'),
    )

    expect(issued.issuedReference).toBe('INV-0001')
    await expect(
      repos.documents.updateDraft(created.id, { totalMinor: 9 }, ctx('d1-edit')),
    ).rejects.toThrow(RepositoryError)
  })

  it('lets a draft be edited freely before issue', async () => {
    const created = await repos.documents.createDraft(draft(), ctx('d2'))
    const updated = await repos.documents.updateDraft(
      created.id,
      { totalMinor: 2_000_000 },
      ctx('d2-edit'),
    )
    expect(updated.totalMinor).toBe(2_000_000)
    expect(updated.issuedReference).toBeNull()
  })

  it('never lets an edit overwrite the frozen reference or labels', async () => {
    const created = await repos.documents.createDraft(draft(), ctx('d3'))
    const updated = await repos.documents.updateDraft(
      created.id,
      { issuedReference: 'FORGED', frozenLabels: null },
      ctx('d3-edit'),
    )
    expect(updated.issuedReference).toBeNull()
  })

  it('refuses a transition the lifecycle does not allow', async () => {
    const created = await repos.documents.createDraft(draft(), ctx('d4'))
    await repos.documents.issue(
      created.id,
      {
        reference: 'INV-0002',
        frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'invoice'),
        totalMinor: 1_500_000,
      },
      ctx('d4-issue'),
    )
    await expect(repos.documents.transition(created.id, 'draft', ctx('d4-back'))).rejects.toThrow()
  })
})

describe('Delivery evidence is one write, and captured once (§P)', () => {
  const dispatched = async () => {
    const created = await repos.documents.createDraft(
      { ...draft(), type: 'waybill', totalMinor: 0, lineItems: [] },
      ctx('w1'),
    )
    await repos.documents.issue(
      created.id,
      { reference: 'WB-0001', frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'waybill'), totalMinor: 0 },
      ctx('w2'),
    )
    await repos.documents.transition(created.id, 'dispatched', ctx('w3'))
    return created.id
  }

  const evidence = {
    signerName: 'Bisi Adeyemi',
    signerRole: 'Storekeeper',
    signedAt: '2026-09-12T14:30:00Z',
    signatureAssetId: 'ast_1',
  }

  it('applies the mark, the signer, the moment and the status together', async () => {
    const id = await dispatched()
    const signed = await repos.documents.signDelivery(id, evidence, ctx('sign-1'))

    expect(signed.status).toBe('delivered')
    expect(signed.signerName).toBe('Bisi Adeyemi')
    expect(signed.signerRole).toBe('Storekeeper')
    expect(signed.signedAt).toBe('2026-09-12T14:30:00Z')
    expect(signed.signatureAssetId).toBe('ast_1')
  })

  it('refuses to re-sign a delivery already signed for', async () => {
    const id = await dispatched()
    await repos.documents.signDelivery(id, evidence, ctx('sign-1'))

    // A later link use, a second device, a retried tap under a fresh key:
    // the evidence is sealed and none of them may alter it (§P).
    await expect(
      repos.documents.signDelivery(
        id,
        { ...evidence, signerName: 'Somebody Else', signatureAssetId: 'ast_2' },
        ctx('sign-2'),
      ),
    ).rejects.toThrow(RepositoryError)

    const after = await repos.documents.get(ACME, id)
    expect(after?.signerName).toBe('Bisi Adeyemi')
    expect(after?.signatureAssetId).toBe('ast_1')
  })

  it('refuses a delivery that never went out', async () => {
    const created = await repos.documents.createDraft(
      { ...draft(), type: 'waybill', totalMinor: 0, lineItems: [] },
      ctx('w1'),
    )
    await expect(
      repos.documents.signDelivery(created.id, evidence, ctx('sign-1')),
    ).rejects.toThrow()
  })

  it('writes once however often the same tap is replayed (§M)', async () => {
    const id = await dispatched()
    for (const _ of [1, 2, 3]) await repos.documents.signDelivery(id, evidence, ctx('sign-1'))
    const after = await repos.documents.get(ACME, id)
    expect(after?.signedAt).toBe('2026-09-12T14:30:00Z')
  })
})

describe('A delivery photo is evidence being captured, not a document edited (§P)', () => {
  const dispatched = async () => {
    const created = await repos.documents.createDraft(
      { ...draft(), type: 'waybill', totalMinor: 0, lineItems: [] },
      ctx('p1'),
    )
    await repos.documents.issue(
      created.id,
      { reference: 'WAY-0001', frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'waybill'), totalMinor: 0 },
      ctx('p2'),
    )
    await repos.documents.transition(created.id, 'dispatched', ctx('p3'))
    return created.id
  }

  it('attaches to an ISSUED delivery, which updateDraft would refuse', async () => {
    const id = await dispatched()
    const updated = await repos.documents.attachDeliveryPhoto(id, 'ast_1', ctx('photo-1'))
    expect(updated.deliveryPhotoAssetId).toBe('ast_1')
    expect(updated.status).toBe('dispatched')
    // Evidence captured, not a document edited: nothing else moved.
    expect(updated.issuedReference).toBe('WAY-0001')
  })

  it('refuses a delivery already signed for', async () => {
    const id = await dispatched()
    await repos.documents.signDelivery(
      id,
      {
        signerName: 'Bisi Adeyemi',
        signedAt: '2026-09-12T14:30:00Z',
        signatureAssetId: 'ast_sig',
      },
      ctx('sign-1'),
    )

    await expect(
      repos.documents.attachDeliveryPhoto(id, 'ast_late', ctx('photo-1')),
    ).rejects.toThrow(RepositoryError)

    const after = await repos.documents.get(ACME, id)
    expect(after?.deliveryPhotoAssetId).toBeUndefined()
  })

  it('refuses a draft, which is nothing to be evidence of yet', async () => {
    const created = await repos.documents.createDraft(
      { ...draft(), type: 'waybill', totalMinor: 0, lineItems: [] },
      ctx('p1'),
    )
    await expect(
      repos.documents.attachDeliveryPhoto(created.id, 'ast_1', ctx('photo-1')),
    ).rejects.toThrow(RepositoryError)
  })

  it('replaces the reference, leaving the old asset alone (§P)', async () => {
    const id = await dispatched()
    await repos.documents.attachDeliveryPhoto(id, 'ast_1', ctx('photo-1'))
    const updated = await repos.documents.attachDeliveryPhoto(id, 'ast_2', ctx('photo-2'))
    expect(updated.deliveryPhotoAssetId).toBe('ast_2')
  })

  it('attaches once however often the same tap is replayed (§M)', async () => {
    const id = await dispatched()
    for (const _ of [1, 2, 3]) {
      await repos.documents.attachDeliveryPhoto(id, 'ast_1', ctx('photo-1'))
    }
    const after = await repos.documents.get(ACME, id)
    expect(after?.deliveryPhotoAssetId).toBe('ast_1')
  })
})

describe('Public-link tokens: only the hash, and one per document (§P)', () => {
  const minted = (over: Record<string, unknown> = {}) => ({
    documentId: 'doc_1',
    companyId: ACME,
    tokenHash: 'a'.repeat(64),
    expiresAt: '2026-09-27T00:00:00Z',
    ...over,
  })

  it('stores a token and reads it back', async () => {
    await repos.linkTokens.mint(minted(), ctx('link-1'))
    const row = await repos.linkTokens.get(ACME, 'doc_1')
    expect(row?.tokenHash).toBe('a'.repeat(64))
    expect(row?.consumedAt).toBeUndefined()
  })

  it('replaces the live token, so one link per document (§P)', async () => {
    await repos.linkTokens.mint(minted(), ctx('link-1'))
    await repos.linkTokens.mint(minted({ tokenHash: 'b'.repeat(64) }), ctx('link-2'))

    // Two live links would mean two ways in and only one of them revocable.
    expect(state.linkTokens).toHaveLength(1)
    expect((await repos.linkTokens.get(ACME, 'doc_1'))?.tokenHash).toBe('b'.repeat(64))
  })

  it('mints once however often the same tap is replayed (§M)', async () => {
    for (const _ of [1, 2, 3]) await repos.linkTokens.mint(minted(), ctx('link-1'))
    expect(state.linkTokens).toHaveLength(1)
  })

  it('never returns another company token', async () => {
    await repos.linkTokens.mint(minted(), ctx('link-1'))
    expect(await repos.linkTokens.get(RIVAL, 'doc_1')).toBeNull()
  })

  it('holds nothing that could be turned back into a link', async () => {
    await repos.linkTokens.mint(minted(), ctx('link-1'))
    // Only the hash: a leaked row cannot open a link.
    expect(Object.keys(state.linkTokens[0] ?? {}).sort()).toEqual([
      'companyId',
      'documentId',
      'expiresAt',
      'tokenHash',
    ])
  })
})

describe('An asset is evidence: written once, never changed (§P)', () => {
  const mark = {
    companyId: ACME,
    kind: 'signature' as const,
    dataUrl: 'data:image/svg+xml,%3Csvg%2F%3E',
    createdAt: '2026-09-12T14:30:00Z',
  }

  it('stores once however often the same draw is replayed (§M)', async () => {
    for (const _ of [1, 2, 3]) await repos.assets.store(mark, ctx('ast-1'))
    expect(state.assets).toHaveLength(1)
  })

  it('offers no way to change or remove one', () => {
    // Drawing again makes a NEW asset, so an issued document's mark cannot
    // change under it (Rule #5). There is no update and no delete here.
    expect(Object.keys(repos.assets).sort()).toEqual(['get', 'list', 'store'])
  })

  it('never returns another company assets', async () => {
    await repos.assets.store(mark, ctx('ast-1'))
    await repos.assets.store({ ...mark, companyId: RIVAL }, ctx('ast-2'))
    expect(await repos.assets.list(ACME)).toHaveLength(1)
  })
})

describe('Every read is company-scoped', () => {
  it('never returns another company rows', async () => {
    await repos.customers.create({ companyId: RIVAL, kind: 'person', name: 'Theirs', labels: [] }, ctx('r1'))
    await repos.documents.createDraft(draft(RIVAL), ctx('r2'))

    expect(await repos.customers.list(ACME)).toEqual([])
    expect(await repos.documents.listByType(ACME, 'invoice')).toEqual([])
    expect(await repos.customers.search(ACME, 'Theirs')).toEqual([])
    expect(await repos.documents.get(ACME, (state.documents[0] as { id: string }).id)).toBeNull()
  })
})

describe('The catalogue builds itself from what gets typed (§L2)', () => {
  it('remembers a new item and counts the next use', async () => {
    const first = await repos.items.remember(
      { companyId: ACME, name: 'Cement', lastPrice: money('NGN', 500_000) },
      ctx('i1'),
    )
    expect(first.timesUsed).toBe(1)

    const again = await repos.items.remember(
      { companyId: ACME, name: 'cement', lastPrice: money('NGN', 550_000) },
      ctx('i2'),
    )
    expect(again.id).toBe(first.id)
    expect(again.timesUsed).toBe(2)
    expect(again.lastPrice).toEqual(money('NGN', 550_000))
  })

  it('suggests by prefix, scoped to the company', async () => {
    await repos.items.remember({ companyId: ACME, name: 'Cement' }, ctx('i3'))
    await repos.items.remember({ companyId: RIVAL, name: 'Cement' }, ctx('i4'))

    expect((await repos.items.suggest(ACME, 'cem')).map((i) => i.name)).toEqual(['Cement'])
    expect(await repos.items.suggest(ACME, '')).toEqual([])
  })
})

describe('Search matches the frozen label as well as the type (§D.3)', () => {
  it('finds an issued document by its frozen printed title', async () => {
    const created = await repos.documents.createDraft({ ...draft(), type: 'waybill' }, ctx('s1'))
    await repos.documents.issue(
      created.id,
      {
        reference: 'WAY-0001',
        frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'waybill'),
        totalMinor: 0,
      },
      ctx('s1-issue'),
    )

    expect((await repos.documents.search(ACME, 'waybill')).map((d) => d.issuedReference)).toEqual([
      'WAY-0001',
    ])
    expect(await repos.documents.search(ACME, 'WAY-0001')).toHaveLength(1)
  })
})
