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
