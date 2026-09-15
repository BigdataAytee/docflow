/**
 * The repository contracts — run against EVERY implementation (§C, §Q Phase 4).
 *
 * These assert what a repository MEANS: mutations are idempotent, issued
 * documents refuse edits, reads are company-scoped, search matches the frozen
 * label, delivery evidence is one write and is captured once. A caller must
 * never discover one of those rules only when it reaches a real database.
 *
 * Which is why the suite no longer runs against the in-memory store alone. It
 * runs, case for case, against both that and SQLite — the implementation the
 * phone actually uses, on the real engine, via `node:sqlite`. Before Phase 4
 * the file said "every implementation must pass the same suite" and only one
 * implementation existed to say it about.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type Repositories, RepositoryError } from './index'
import type { CountableTable, RepositoryHarness } from './harness'
import { memoryHarness } from './memory/harness'
import { sqliteHarness } from '../sqlite/harness'
import { freezeLabels } from '../../domain/locale/profile'
import { money } from '../../domain/money/money'
import { quantity } from '../../domain/documents/types'

const ACME = 'co_acme'
const RIVAL = 'co_rival'

const ctx = (key: string) => ({ idempotencyKey: key })

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

for (const harness of [memoryHarness, sqliteHarness]) {
  describe(harness.name, () => {
    contract(harness)
  })
}

/**
 * Declared, not inlined, so the two runs above read as one sentence. Hoisting
 * makes the order legal; the suite is the same object either way.
 */
function contract(harness: RepositoryHarness): void {
let repos: Repositories
let count: (table: CountableTable) => Promise<number>
let linkTokenFields: () => Promise<string[]>
let dispose: () => Promise<void>

beforeEach(async () => {
  const store = await harness.create([ACME, RIVAL])
  repos = store.repositories
  count = store.count
  linkTokenFields = store.linkTokenFields
  dispose = store.dispose
})

afterEach(async () => {
  await dispose()
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

    // The same RECORD, not necessarily the same object: a store that reads the
    // row back satisfies §M exactly as well as one that returns its own array
    // entry. That one row exists is asserted on the next line.
    expect(replayed).toEqual(first)
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
    expect(await count('payments')).toBe(1)
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

describe('A repeat is a schedule, not a screen (§L4)', () => {
  const schedule = (over: Partial<Parameters<typeof repos.recurrences.start>[0]> = {}) => ({
    companyId: ACME,
    sourceDocumentId: 'doc_inv',
    dayOfMonth: 10,
    startedOn: '2026-01-10',
    ...over,
  })

  it('stores a schedule and reads it back', async () => {
    await repos.recurrences.start(schedule(), ctx('r1'))
    expect(await repos.recurrences.list(ACME)).toEqual([schedule()])
  })

  /**
   * One schedule per document. Switching Repeat on for a document that
   * already repeats is the SAME schedule — two rows would mean two catch-ups
   * for one invoice, which is a duplicate with extra steps.
   */
  it('replaces rather than adds when Repeat is switched on twice', async () => {
    await repos.recurrences.start(schedule(), ctx('r2a'))
    await repos.recurrences.start(schedule({ dayOfMonth: 25 }), ctx('r2b'))

    const stored = await repos.recurrences.list(ACME)
    expect(stored).toHaveLength(1)
    expect(stored[0]?.dayOfMonth).toBe(25)
  })

  it('ends a schedule rather than deleting it, so the drafts keep their reason', async () => {
    await repos.recurrences.start(schedule(), ctx('r3'))
    const stopped = await repos.recurrences.stop(ACME, 'doc_inv', '2026-04-01', ctx('r3-stop'))

    expect(stopped.endedOn).toBe('2026-04-01')
    expect(await repos.recurrences.list(ACME)).toHaveLength(1)
  })

  /**
   * A stopped schedule that is switched back on must lose its end date, or
   * `catchUp` reads it as still ended and silently produces nothing — a
   * toggle that says ON while doing nothing, which is the bug this whole
   * feature exists to fix.
   */
  it('clears the end date when a stopped repeat is started again', async () => {
    await repos.recurrences.start(schedule(), ctx('r4'))
    await repos.recurrences.stop(ACME, 'doc_inv', '2026-04-01', ctx('r4-stop'))
    await repos.recurrences.start(schedule({ startedOn: '2026-05-10' }), ctx('r4-again'))

    expect((await repos.recurrences.list(ACME))[0]?.endedOn).toBeUndefined()
  })

  it('refuses to stop a repeat that another company owns', async () => {
    await repos.recurrences.start(schedule(), ctx('r5'))
    await expect(
      repos.recurrences.stop(RIVAL, 'doc_inv', '2026-04-01', ctx('r5-stop')),
    ).rejects.toThrow(RepositoryError)
  })

  it('never lists the schedules of another company', async () => {
    await repos.recurrences.start(schedule(), ctx('r6'))
    expect(await repos.recurrences.list(RIVAL)).toEqual([])
  })
})

describe('A document remembers how it looks (§H, Rule #3)', () => {
  /**
   * The four design choices used to live in the builder's component state,
   * so closing the screen threw them away. The discount was the serious one:
   * it is applied at issue and baked into `totalMinor`, so the stored total
   * was right while the breakdown behind it could not be reproduced — a page
   * recomposed from the record printed a subtotal that disagreed with its own
   * payable. Rule #3 says money is never inferred; that was inference.
   */
  it('stores the design, the colour and the discount rate', async () => {
    const created = await repos.documents.createDraft(draft(), ctx('g1'))
    await repos.documents.updateDraft(
      created.id,
      {
        templateId: 'aurora',
        showLogo: false,
        brandColour: '#0F6E56',
        discountRatePpm: 75_000,
      },
      ctx('g1-design'),
    )

    const reloaded = await repos.documents.get(ACME, created.id)
    expect(reloaded?.templateId).toBe('aurora')
    expect(reloaded?.brandColour).toBe('#0F6E56')
    expect(reloaded?.discountRatePpm).toBe(75_000)
  })

  /**
   * SQLite has no boolean, and `?? null` on the way in would turn a logo that
   * was deliberately switched OFF into "never chosen" — which reads back as
   * the default, which is ON. The one value in this set that can be lost by
   * being falsy, so it gets its own case.
   */
  it('keeps a logo that was switched off switched off', async () => {
    const created = await repos.documents.createDraft(draft(), ctx('g2'))
    await repos.documents.updateDraft(created.id, { showLogo: false }, ctx('g2-off'))
    expect((await repos.documents.get(ACME, created.id))?.showLogo).toBe(false)
  })

  /** Freezes with everything else: the only way in refuses an issued document. */
  it('will not restyle a document after it is issued', async () => {
    const created = await repos.documents.createDraft(draft(), ctx('g3'))
    await repos.documents.issue(
      created.id,
      {
        reference: 'INV-0003',
        frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'invoice'),
        totalMinor: 1_500_000,
      },
      ctx('g3-issue'),
    )
    await expect(
      repos.documents.updateDraft(created.id, { templateId: 'bold' }, ctx('g3-restyle')),
    ).rejects.toThrow(RepositoryError)
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
    expect(await count('linkTokens')).toBe(1)
    expect((await repos.linkTokens.get(ACME, 'doc_1'))?.tokenHash).toBe('b'.repeat(64))
  })

  it('mints once however often the same tap is replayed (§M)', async () => {
    for (const _ of [1, 2, 3]) await repos.linkTokens.mint(minted(), ctx('link-1'))
    expect(await count('linkTokens')).toBe(1)
  })

  it('never returns another company token', async () => {
    await repos.linkTokens.mint(minted(), ctx('link-1'))
    expect(await repos.linkTokens.get(RIVAL, 'doc_1')).toBeNull()
  })

  it('holds nothing that could be turned back into a link', async () => {
    await repos.linkTokens.mint(minted(), ctx('link-1'))
    // Only the hash: a leaked row cannot open a link.
    expect(await linkTokenFields()).toEqual(['companyId', 'documentId', 'expiresAt', 'tokenHash'])
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
    expect(await count('assets')).toBe(1)
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
    const theirs = await repos.documents.createDraft(draft(RIVAL), ctx('r2'))

    expect(await repos.customers.list(ACME)).toEqual([])
    expect(await repos.documents.listByType(ACME, 'invoice')).toEqual([])
    expect(await repos.customers.search(ACME, 'Theirs')).toEqual([])
    // Asked for by id, across the boundary — the row exists, and is still
    // invisible from here.
    expect(await count('documents')).toBe(1)
    expect(await repos.documents.get(ACME, theirs.id)).toBeNull()
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

}
