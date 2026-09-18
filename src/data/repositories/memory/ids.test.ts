/**
 * A minted id must never be one the seed already used (§M).
 *
 * FOUND BY WALKING IT ON A PHONE, which is the only reason it was found at
 * all. Recording a cash payment from a new name, "Musa Adamu", produced a
 * receipt made out to Okoro & Sons Ltd — and Musa's own balance showed
 * Okoro's ₦1,227,012.50.
 *
 * The name had been stored correctly. The counter started at zero and knew
 * nothing about the state it was handed, so the first customer added to a
 * SEEDED store was minted `cus_1` — the id the seed had already given
 * somebody else. Two customers, one id, and every lookup by id returns
 * whichever `find` reaches first.
 *
 * Demo-only — SQLite and Supabase both mint UUIDs — but the samples app is
 * what anybody judges the product by, and it was attributing money to the
 * wrong customer.
 */

import { describe, expect, it } from 'vitest'

import { createMemoryRepositories, emptyState } from '..'
import type { MemoryState } from './store'

const ctx = (key: string) => ({ deviceId: 'dev_1', idempotencyKey: key })

const seeded = (): MemoryState => ({
  ...emptyState(),
  customers: [
    { id: 'cus_1', companyId: 'co_1', kind: 'company', name: 'Okoro & Sons Ltd', labels: [] },
    { id: 'cus_2', companyId: 'co_1', kind: 'person', name: 'Bisi', labels: [] },
  ],
})

describe('Minted ids do not collide with seeded ones', () => {
  /** THE ONE THIS IS FOR. */
  it('does not reuse a seeded customer id', async () => {
    const state = seeded()
    const repositories = createMemoryRepositories(state)

    const made = await repositories.customers.create(
      { companyId: 'co_1', kind: 'person', name: 'Musa Adamu', labels: [] },
      ctx('c1'),
    )

    expect(made.id, 'the new customer took a seeded id').not.toBe('cus_1')
    expect(made.id).not.toBe('cus_2')

    /*
     * And the consequence the walk actually showed: looking the new customer
     * up by id finds THEM, not the person whose id was reused.
     */
    const found = state.customers.filter((row) => row.id === made.id)
    expect(found, 'two customers share one id').toHaveLength(1)
    expect(found[0]?.name).toBe('Musa Adamu')
  })

  it('does not reuse a seeded document id', async () => {
    const state: MemoryState = {
      ...seeded(),
      documents: [
        {
          id: 'doc_5',
          companyId: 'co_1',
          type: 'invoice',
          status: 'draft',
          currency: 'NGN',
          lineItems: [],
          issuedReference: null,
          frozenLabels: null,
          totalMinor: 0,
        },
      ],
    }
    const repositories = createMemoryRepositories(state)

    const made = await repositories.documents.createDraft(
      {
        companyId: 'co_1',
        type: 'invoice',
        status: 'draft',
        currency: 'NGN',
        lineItems: [],
        totalMinor: 0,
      },
      ctx('d1'),
    )
    expect(made.id).not.toBe('doc_5')
    expect(state.documents.filter((row) => row.id === made.id)).toHaveLength(1)
  })

  /**
   * Ids are base-36, so `doc_z` is 35 and the next must be past it — a naive
   * count of the rows would have handed out `doc_2` and collided.
   */
  it('counts past a base-36 id rather than past the row count', async () => {
    const state: MemoryState = {
      ...emptyState(),
      customers: [{ id: 'cus_z', companyId: 'co_1', kind: 'person', name: 'Zed', labels: [] }],
    }
    const repositories = createMemoryRepositories(state)
    const made = await repositories.customers.create(
      { companyId: 'co_1', kind: 'person', name: 'New', labels: [] },
      ctx('c2'),
    )
    expect(Number.parseInt(made.id.slice(made.id.lastIndexOf('_') + 1), 36)).toBeGreaterThan(35)
  })
})
