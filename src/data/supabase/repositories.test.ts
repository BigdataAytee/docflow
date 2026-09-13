/**
 * The Supabase repositories, asserted on the requests they actually build.
 *
 * See `harness.ts` for why this uses the real client over a stub transport
 * rather than a stubbed client.
 */

import { describe, expect, it } from 'vitest'

import { harness } from './harness'
import { createCompanyRepository, createCustomerRepository } from './repositories'
import { createDocumentRepository } from './documents'
import { RepositoryError } from '../repositories'

const ACME = '11111111-1111-1111-1111-111111111111'
const ctx = (idempotencyKey: string) => ({ idempotencyKey })

const customerRow = {
  id: 'cus_1',
  company_id: ACME,
  kind: 'person',
  name: 'Okoro',
  labels: [],
}

const draftRow = {
  id: 'doc_1',
  company_id: ACME,
  type: 'invoice',
  status: 'draft',
  currency: 'NGN',
  line_items: [],
  total_minor: 0,
  issued_reference: null,
  frozen_labels: null,
}

describe('A list is scoped to one company, and a read is not (§P)', () => {
  it('filters a list by company_id', async () => {
    const h = harness([[customerRow]])
    await createCustomerRepository(h.db).list(ACME)

    expect(h.call(0).method).toBe('GET')
    expect(h.call(0).table).toBe('customers')
    expect(h.call(0).params.get('company_id')).toBe(`eq.${ACME}`)
  })

  it('reads one row by id alone, leaving the boundary to RLS', async () => {
    const h = harness([[customerRow]])
    await createCustomerRepository(h.db).get(ACME, 'cus_1')

    // Deliberately no company_id filter: a second enforcement point is a
    // second place to be wrong, and it would pass its own tests while the
    // policy underneath it rotted.
    expect(h.call(0).params.get('id')).toBe('eq.cus_1')
    expect(h.call(0).params.get('company_id')).toBeNull()
  })

  it('returns null rather than throwing when a row is not visible', async () => {
    const h = harness([[]])
    expect(await createCustomerRepository(h.db).get(ACME, 'cus_gone')).toBeNull()
  })

  it('turns a PostgREST error into a RepositoryError, never a silent null', async () => {
    const h = harness([{ error: { message: 'permission denied' } }])
    await expect(createCustomerRepository(h.db).get(ACME, 'cus_1')).rejects.toThrow(RepositoryError)
  })
})

describe('Search asks about the columns it claims to (§D.3)', () => {
  it('searches a customer by every contact field', async () => {
    const h = harness([[customerRow]])
    await createCustomerRepository(h.db).search(ACME, 'Okoro')

    const or = h.call(0).params.get('or')
    expect(or).toBe('(name.ilike.%Okoro%,phone.ilike.%Okoro%,email.ilike.%Okoro%,address.ilike.%Okoro%)')
    expect(h.call(0).params.get('company_id')).toBe(`eq.${ACME}`)
  })

  it('searches a document by the label frozen at issue, not only the current one', async () => {
    const h = harness([[draftRow]])
    await createDocumentRepository(h.db).search(ACME, 'Proforma')

    // A quotation issued as "Proforma" must stay findable by the word printed
    // on it after the company's terminology changes (Rule #5).
    expect(h.call(0).params.get('or')).toContain('frozen_labels->>printedTitle.ilike.%Proforma%')
  })

  it('shows everything for an empty search, and for one that is only punctuation', async () => {
    for (const query of ['', '   ', '(),']) {
      const h = harness([[customerRow]])
      await createCustomerRepository(h.db).search(ACME, query)
      expect(h.call(0).params.get('or'), `query ${JSON.stringify(query)}`).toBeNull()
    }
  })

  it('does not let a typed wildcard silently widen the search', async () => {
    const h = harness([[customerRow]])
    await createCustomerRepository(h.db).search(ACME, '50%')

    // Left in, `%` matches anything: a search for "50%" would quietly return
    // every row starting with "50".
    expect(h.call(0).params.get('or')).toBe(
      '(name.ilike.%50%,phone.ilike.%50%,email.ilike.%50%,address.ilike.%50%)',
    )
  })

  it('does not let a comma be read as another filter', async () => {
    const h = harness([[customerRow]])
    await createCustomerRepository(h.db).search(ACME, 'Okoro, Sons & Co')
    expect(h.call(0).params.get('or')).not.toContain(',name')
  })
})

describe('A create happens once, whoever wins the race (§M)', () => {
  it('sends the key with the row and asks the database to ignore a duplicate', async () => {
    const h = harness([[customerRow]])
    await createCustomerRepository(h.db).create(
      { companyId: ACME, kind: 'person', name: 'Okoro', labels: [] },
      ctx('cus:okoro'),
    )

    expect(h.call(0).method).toBe('POST')
    expect(h.call(0).body).toMatchObject({
      company_id: ACME,
      name: 'Okoro',
      idempotency_key: 'cus:okoro',
    })
    // `resolution=ignore-duplicates` is what makes the unique index in
    // 0009_idempotency.sql decide the race instead of raising.
    expect(h.call(0).prefer).toContain('resolution=ignore-duplicates')
    expect(h.call(0).params.get('on_conflict')).toBe('company_id,idempotency_key')
  })

  it('reads back the winner row when its own insert was ignored', async () => {
    // First exchange writes nothing (the key was already used); the second
    // fetches what is there. A retry must return the record, not an error.
    const h = harness([[], [{ ...customerRow, name: 'Okoro', idempotency_key: 'cus:okoro' }]])
    const created = await createCustomerRepository(h.db).create(
      { companyId: ACME, kind: 'person', name: 'Okoro', labels: [] },
      ctx('cus:okoro'),
    )

    expect(created.name).toBe('Okoro')
    expect(h.calls).toHaveLength(2)
    expect(h.call(1).method).toBe('GET')
    expect(h.call(1).params.get('idempotency_key')).toBe('eq.cus:okoro')
    expect(h.call(1).params.get('company_id')).toBe(`eq.${ACME}`)
  })
})

describe('A replayed mutation returns the record, before any guard (§M)', () => {
  it('returns an already-issued document instead of refusing to issue it twice', async () => {
    const issued = {
      ...draftRow,
      status: 'issued',
      issued_reference: 'INV-0001',
      frozen_labels: { printedTitle: 'Invoice' },
      idempotency_key: 'issue:doc_1',
    }
    const h = harness([[issued]])

    const back = await createDocumentRepository(h.db).issue(
      'doc_1',
      { reference: 'INV-0001', frozenLabels: { printedTitle: 'Invoice' } as never, totalMinor: 0 },
      ctx('issue:doc_1'),
    )

    // One request: the read. The guard is never reached, and nothing is
    // written — `assertTransition('invoice', 'issued', 'issued')` would have
    // refused a document that IS issued, which the owner could not act on.
    expect(back.issuedReference).toBe('INV-0001')
    expect(h.calls).toHaveLength(1)
    expect(h.call(0).method).toBe('GET')
  })

  it('freezes reference, labels, total and status in one write', async () => {
    const h = harness([[draftRow], [{ ...draftRow, status: 'issued', issued_reference: 'INV-0001' }]])
    await createDocumentRepository(h.db).issue(
      'doc_1',
      { reference: 'INV-0001', frozenLabels: { printedTitle: 'Invoice' } as never, totalMinor: 14_500_00 },
      ctx('issue:doc_1'),
    )

    expect(h.call(1).method).toBe('PATCH')
    expect(h.call(1).body).toMatchObject({
      status: 'issued',
      issued_reference: 'INV-0001',
      frozen_labels: { printedTitle: 'Invoice' },
      total_minor: 14_500_00,
      idempotency_key: 'issue:doc_1',
    })
  })
})

describe('Issued documents stay immutable (Rule #5)', () => {
  it('refuses to edit an issued document, without writing anything', async () => {
    const h = harness([[{ ...draftRow, status: 'issued', issued_reference: 'INV-0001' }]])

    await expect(
      createDocumentRepository(h.db).updateDraft('doc_1', { totalMinor: 1 }, ctx('edit')),
    ).rejects.toThrow(/immutable/)
    expect(h.calls).toHaveLength(1)
  })

  it('strips the frozen pair from a draft patch even though the type forbids it', async () => {
    const h = harness([[draftRow], [draftRow]])
    await createDocumentRepository(h.db).updateDraft(
      'doc_1',
      // A patch arriving from sync is a plain object; Rule #5 must not depend
      // on the caller having been typechecked.
      { issuedReference: 'FORGED', frozenLabels: { printedTitle: 'X' }, totalMinor: 5 } as never,
      ctx('edit'),
    )

    expect(h.call(1).body).not.toHaveProperty('issued_reference')
    expect(h.call(1).body).not.toHaveProperty('frozen_labels')
    expect(h.call(1).body).toMatchObject({ total_minor: 5 })
  })
})

describe('Delivery evidence seals (§P)', () => {
  const inTransit = { ...draftRow, type: 'waybill', status: 'in_transit' }

  it('writes the mark, the signer, the moment and the status together', async () => {
    const h = harness([[inTransit], [{ ...inTransit, status: 'delivered' }]])
    await createDocumentRepository(h.db).signDelivery(
      'doc_1',
      {
        signerName: 'Ada',
        signerRole: 'Storekeeper',
        signedAt: '2026-09-13T10:00:00Z',
        signatureAssetId: 'ast_1',
      },
      ctx('sign:doc_1'),
    )

    expect(h.call(1).method).toBe('PATCH')
    expect(h.call(1).body).toMatchObject({
      signer_name: 'Ada',
      signer_role: 'Storekeeper',
      signed_at: '2026-09-13T10:00:00Z',
      signature_asset_id: 'ast_1',
      status: 'delivered',
    })
  })

  it('refuses a second signature on a delivery already signed for', async () => {
    const h = harness([[{ ...inTransit, status: 'delivered' }]])
    await expect(
      createDocumentRepository(h.db).signDelivery(
        'doc_1',
        { signerName: 'Someone else', signedAt: '2026-09-13T11:00:00Z', signatureAssetId: 'ast_2' },
        ctx('sign:again'),
      ),
    ).rejects.toThrow(/already signed for/)
    expect(h.calls).toHaveLength(1)
  })

  it('refuses a photo on a draft, which is evidence of nothing yet', async () => {
    const h = harness([[{ ...draftRow, type: 'waybill' }]])
    await expect(
      createDocumentRepository(h.db).attachDeliveryPhoto('doc_1', 'ast_1', ctx('photo')),
    ).rejects.toThrow(/not been issued/)
  })
})

describe('A write that raced is reported, not overwritten', () => {
  it('conditions the update on the status it read', async () => {
    const h = harness([[draftRow], [draftRow]])
    await createDocumentRepository(h.db).updateDraft('doc_1', { totalMinor: 5 }, ctx('edit'))

    expect(h.call(1).params.get('id')).toBe('eq.doc_1')
    expect(h.call(1).params.get('status')).toBe('eq.draft')
  })

  it('says so when the row moved under the edit', async () => {
    // The conditional update matches nothing: someone else issued it first.
    const h = harness([[draftRow], []])
    await expect(
      createDocumentRepository(h.db).updateDraft('doc_1', { totalMinor: 5 }, ctx('edit')),
    ).rejects.toThrow(/changed while this edit was being made/)
  })
})

describe('The company row needs no idempotency key', () => {
  it('updates by id and sends no key', async () => {
    const companyRow = {
      id: ACME,
      name: 'Renamed',
      currency: 'NGN',
      locale_region: 'NG',
      locale_language: 'en',
      label_overrides: {},
      numbering_prefixes: {},
      bank_fields: {},
      enabled_payment_methods: [],
    }
    const h = harness([[companyRow]])
    await createCompanyRepository(h.db).update(ACME, { name: 'Renamed' }, ctx('rename'))

    expect(h.call(0).method).toBe('PATCH')
    expect(h.call(0).params.get('id')).toBe(`eq.${ACME}`)
    // One row per company, always present: a retry rewrites the same values,
    // so there is nothing a key could de-duplicate.
    expect(h.call(0).body).not.toHaveProperty('idempotency_key')
  })
})
