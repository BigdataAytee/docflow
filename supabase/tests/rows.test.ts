/**
 * The row mappers, against the REAL schema (§C, §E).
 *
 * Every other test of `src/data/supabase/rows.ts` compares an object this
 * repo wrote to an object this repo expected — which proves the mapper is
 * self-consistent and nothing about whether the columns exist. That gap is
 * not hypothetical: writing these mappers is what found
 * `documents.delivery_address` missing, a column the shipped `public-link`
 * edge function already SELECTs by name.
 *
 * So each mapper here writes into the migrated schema and reads back out. A
 * column that does not exist fails the INSERT; a column spelled differently
 * comes back absent and fails the comparison. Neither can be argued with.
 *
 * Runs against the Postgres service container, with no secrets and no hosted
 * project — the same harness the RLS gate uses.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, connectionString } from './apply'
import {
  fromAsset,
  fromCompany,
  fromCustomer,
  fromDocument,
  fromExpense,
  fromItem,
  fromLinkToken,
  fromPayment,
  fromAllocation,
  fromShareEvent,
  fromCreditNote,
  toAsset,
  toCompany,
  toCustomer,
  toDocument,
  toExpense,
  toItem,
  toLinkToken,
  toPayment,
  toShareEvent,
  toCreditNote,
} from '../../src/data/supabase/rows'
import { money } from '../../src/domain/money/money'
import { quantity } from '../../src/domain/documents/types'
import type { DocumentRecord } from '../../src/data/repositories'

const COMPANY = '11111111-1111-1111-1111-111111111111'
const CUSTOMER = 'aaaaaaaa-0000-0000-0000-000000000001'

let db: Client

/**
 * Which columns are jsonb, read from the database rather than kept by hand.
 *
 * A JS array is ambiguous on the wire: `customers.labels` is a real Postgres
 * `text[]`, while `documents.line_items` is a jsonb array. `pg` serialises a
 * JS array to an array literal, which is right for the first and rejected by
 * the second; JSON.stringify is right for the second and rejected by the
 * first. No blanket rule can serve both, so the test asks the schema — which
 * also means a column that changes type later cannot quietly pass here.
 *
 * PostgREST, the path the app actually uses, does this same disambiguation
 * server-side from the column type, so the mappers stay free of it.
 */
const jsonColumns = new Map<string, Set<string>>()

async function jsonColumnsFor(table: string): Promise<Set<string>> {
  const cached = jsonColumns.get(table)
  if (cached !== undefined) return cached
  const { rows } = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1 and udt_name in ('json', 'jsonb')`,
    [table],
  )
  const names = new Set(rows.map((r) => r.column_name))
  jsonColumns.set(table, names)
  return names
}

/** Insert a mapped row as service_role and read the whole row back. */
async function roundTrip(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const json = await jsonColumnsFor(table)
  const keys = Object.keys(row)
  const columns = keys.map((k) => `"${k}"`).join(', ')
  const params = keys.map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await db.query(
    `insert into public.${table} (${columns}) values (${params}) returning *`,
    keys.map((k) => (json.has(k) ? JSON.stringify(row[k]) : row[k])),
  )
  return rows[0] as Record<string, unknown>
}

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)
  await db.query('set role service_role')
  await db.query(
    `insert into public.companies (id, name, currency, locale_region) values ($1, 'Sola Ventures', 'NGN', 'NG')`,
    [COMPANY],
  )
  await db.query(
    `insert into public.customers (id, company_id, name) values ($1, $2, 'Ade Stores')`,
    [CUSTOMER, COMPANY],
  )
})

afterAll(async () => {
  await db?.end()
})

describe('Every mapped field has a column that exists (§E)', () => {
  it('round-trips a company with everything set', async () => {
    const patch = {
      name: 'Sola Ventures',
      localeRegion: 'NG',
      localeLanguage: 'en',
      currency: 'NGN',
      numberingPrefixes: { invoice: 'INV' },
      bankFields: { bank_name: 'GTB' },
      enabledPaymentMethods: ['bank_transfer'],
      brandColour: '#2b3fd6',
      nameStyle: 'serif' as const,
      logoSize: 'L' as const,
      taxRatePpm: 75_000,
      whtRatePpm: 50_000,
      signatureRequired: true,
    }
    const back = toCompany(await roundTrip('companies', fromCompany(patch)))

    expect(back.name).toBe('Sola Ventures')
    expect(back.enabledPaymentMethods).toEqual(['bank_transfer'])
    expect(back.brandColour).toBe('#2b3fd6')
    expect(back.nameStyle).toBe('serif')
    expect(back.logoSize).toBe('L')
    // Parts per million survive the jsonb column as integers (§K).
    expect(back.taxRatePpm).toBe(75_000)
    expect(back.whtRatePpm).toBe(50_000)
    expect(back.signatureRequired).toBe(true)
  })

  it('keeps "the owner removed the default signature" distinct from "unchanged"', async () => {
    // null MEANS something here, so it must survive the round trip as null
    // rather than being dropped like every other empty value (§M).
    const cleared = toCompany(
      await roundTrip('companies', {
        ...fromCompany({ name: 'Cleared', defaultSignatureAssetId: null }),
        currency: 'NGN',
      }),
    )
    expect(cleared.defaultSignatureAssetId).toBeNull()
    expect('defaultSignatureAssetId' in cleared).toBe(true)
  })

  it('round-trips a customer, and an absent field stays absent', async () => {
    const back = toCustomer(
      await roundTrip(
        'customers',
        fromCustomer({
          companyId: COMPANY,
          kind: 'company',
          name: 'Ade Stores',
          phone: '+234 803 111 2222',
          labels: ['Wholesale', 'VIP'],
          privateNote: 'Pays after harvest',
        }),
      ),
    )

    expect(back.name).toBe('Ade Stores')
    expect(back.kind).toBe('company')
    expect(back.phone).toBe('+234 803 111 2222')
    expect(back.labels).toEqual(['Wholesale', 'VIP'])
    expect(back.privateNote).toBe('Pays after harvest')
    // Not `email: undefined`: a record carrying that prints a blank line (§I).
    expect('email' in back).toBe(false)
    expect('address' in back).toBe(false)
  })

  it('round-trips a document with every field the app can set', async () => {
    // The one that matters: this is the list the schema had drifted behind.
    const document: Partial<DocumentRecord> = {
      companyId: COMPANY,
      type: 'waybill',
      status: 'delivered',
      currency: 'NGN',
      customerId: CUSTOMER,
      lineItems: [
        { id: 'li_1', description: 'Bag of cement', quantityMilli: quantity(20), taxable: false },
      ],
      totalMinor: 0,
      issueDate: '2026-09-01',
      dueDate: '2026-09-30',
      validUntil: '2026-10-01',
      issuedReference: 'WAY-0007',
      frozenLabels: {
        printedTitle: 'WAYBILL',
        partyLabel: 'Deliver to',
        signatureCaption: 'RECEIVED BY',
        language: 'en',
      },
      deliveryAddress: '14 Adeola Odeku, Victoria Island',
      driverName: 'Musa',
      vehicleNumber: 'LAG-123-XY',
      dispatchDate: '2026-09-02',
      signerName: 'Bisi Adeyemi',
      signerRole: 'Storekeeper',
      signedAt: '2026-09-03T14:30:00.000Z',
    }
    const back = toDocument(await roundTrip('documents', fromDocument(document)))

    for (const [key, value] of Object.entries(document)) {
      if (key === 'companyId' || key === 'lineItems' || key === 'frozenLabels') continue
      expect({ [key]: back[key as keyof DocumentRecord] }).toEqual({ [key]: value })
    }
    expect(back.lineItems).toEqual(document.lineItems)
    expect(back.frozenLabels).toEqual(document.frozenLabels)
  })

  it('round-trips the links between documents', async () => {
    const first = await roundTrip(
      'documents',
      fromDocument({ companyId: COMPANY, type: 'quotation', status: 'sent', currency: 'NGN', totalMinor: 0 }),
    )
    const second = toDocument(
      await roundTrip(
        'documents',
        fromDocument({
          companyId: COMPANY,
          type: 'quotation',
          status: 'draft',
          currency: 'NGN',
          totalMinor: 0,
          supersedesId: String(first['id']),
          convertedFromId: String(first['id']),
          linkedInvoiceId: String(first['id']),
        }),
      ),
    )
    expect(second.supersedesId).toBe(String(first['id']))
    expect(second.convertedFromId).toBe(String(first['id']))
    expect(second.linkedInvoiceId).toBe(String(first['id']))
  })

  it('keeps a draft reference and labels NULL rather than absent (§M)', async () => {
    const draft = toDocument(
      await roundTrip(
        'documents',
        fromDocument({
          companyId: COMPANY,
          type: 'invoice',
          status: 'draft',
          currency: 'NGN',
          totalMinor: 0,
          issuedReference: null,
          frozenLabels: null,
        }),
      ),
    )
    // Null, not undefined: the null is what says "not issued yet".
    expect(draft.issuedReference).toBeNull()
    expect(draft.frozenLabels).toBeNull()
  })

  it('never lets a bigint come back as a string (Rule #3)', async () => {
    const back = toDocument(
      await roundTrip(
        'documents',
        fromDocument({
          companyId: COMPANY,
          type: 'invoice',
          status: 'issued',
          currency: 'NGN',
          totalMinor: 145_000_00,
        }),
      ),
    )
    // `pg` returns bigint as a string; an amount that reached the domain as
    // "14500000" would compare, sort and add wrongly everywhere.
    expect(back.totalMinor).toBe(145_000_00)
    expect(typeof back.totalMinor).toBe('number')
  })

  it('round-trips a saved item with its price', async () => {
    const back = toItem(
      await roundTrip(
        'items',
        fromItem({
          companyId: COMPANY,
          name: 'Bag of cement',
          unit: 'bag',
          timesUsed: 3,
          lastPrice: money('NGN', 5_000_00),
        }),
      ),
    )
    expect(back.name).toBe('Bag of cement')
    expect(back.unit).toBe('bag')
    expect(back.timesUsed).toBe(3)
    expect(back.lastPrice).toEqual(money('NGN', 5_000_00))
  })

  it('round-trips an expense, photo and all', async () => {
    const asset = await roundTrip(
      'assets',
      fromAsset({ companyId: COMPANY, kind: 'expense_photo', dataUrl: 'data:image/jpeg;base64,x' }),
    )
    const back = toExpense(
      await roundTrip(
        'expenses',
        fromExpense({
          companyId: COMPANY,
          description: 'Diesel',
          category: 'Transport',
          amount: money('NGN', 9_500_00),
          spentOn: '2026-09-11',
          photoAssetId: String(asset['id']),
        }),
      ),
    )
    expect(back.description).toBe('Diesel')
    expect(back.category).toBe('Transport')
    expect(back.amount).toEqual(money('NGN', 9_500_00))
    expect(back.spentOn).toBe('2026-09-11')
    expect(back.photoAssetId).toBe(String(asset['id']))
  })

  it('round-trips an asset, including the inline data URL', async () => {
    const back = toAsset(
      await roundTrip(
        'assets',
        fromAsset({
          companyId: COMPANY,
          kind: 'signature',
          dataUrl: 'data:image/svg+xml,%3Csvg%2F%3E',
        }),
      ),
    )
    expect(back.kind).toBe('signature')
    expect(back.dataUrl).toBe('data:image/svg+xml,%3Csvg%2F%3E')
    expect(back.createdAt).not.toBe('')
  })

  it('round-trips a payment and the allocations beside it', async () => {
    const invoice = await roundTrip(
      'documents',
      fromDocument({ companyId: COMPANY, type: 'invoice', status: 'issued', currency: 'NGN', totalMinor: 50_000_00 }),
    )
    const row = await roundTrip(
      'payments',
      fromPayment({
        companyId: COMPANY,
        customerId: CUSTOMER,
        amount: money('NGN', 50_000_00),
        paidAt: '2026-09-11T10:00:00.000Z',
        method: 'bank_transfer',
        reference: 'FT2609110001',
        source: 'manual',
      }),
    )
    const allocation = await roundTrip('payment_allocations', {
      company_id: COMPANY,
      payment_id: row['id'],
      ...fromAllocation({ invoiceId: String(invoice['id']), amount: money('NGN', 30_000_00) }),
    })

    const back = toPayment(row, [allocation])
    expect(back.amount).toEqual(money('NGN', 50_000_00))
    expect(back.method).toBe('bank_transfer')
    expect(back.reference).toBe('FT2609110001')
    expect(back.source).toBe('manual')
    // The allocation takes its currency from the payment — the table has no
    // currency column, and should not.
    expect(back.allocations[0]?.amount).toEqual(money('NGN', 30_000_00))
    expect(back.allocations[0]?.paymentId).toBe(row['id'])
    // A manual payment has neither of these, and must not carry them as
    // `undefined` — that is a different record from one without them (§I).
    expect('externalEventId' in back).toBe(false)
    expect('reversalOfId' in back).toBe(false)
  })

  it('never lets a payment amount come back as a string (Rule #3)', async () => {
    const row = await roundTrip(
      'payments',
      fromPayment({
        companyId: COMPANY,
        customerId: CUSTOMER,
        amount: money('NGN', 123_456_789),
        paidAt: '2026-09-11T10:00:00.000Z',
        method: 'cash',
        source: 'manual',
      }),
    )
    // `bigint` arrives as a STRING from `pg`. Unconverted, every total built
    // on it becomes string concatenation and the money is silently wrong.
    expect(typeof toPayment(row).amount.minor).toBe('number')
    expect(toPayment(row).amount.minor).toBe(123_456_789)
  })

  it('round-trips a share event, including which route it took (§M)', async () => {
    const document = await roundTrip(
      'documents',
      fromDocument({ companyId: COMPANY, type: 'invoice', status: 'issued', currency: 'NGN', totalMinor: 0 }),
    )
    const back = toShareEvent(
      await roundTrip(
        'audit_log',
        fromShareEvent({
          companyId: COMPANY,
          action: 'shared',
          entity: 'document',
          recordId: String(document['id']),
          at: '2026-09-13T09:00:00.000Z',
          channel: 'clipboard',
          deviceId: 'dev-1',
        }),
      ),
    )

    expect(back.action).toBe('shared')
    expect(back.recordId).toBe(document['id'])
    // A clipboard fallback means the share sheet was unavailable — a
    // materially different handoff, and one §M must not overstate.
    expect(back.channel).toBe('clipboard')
    expect(back.deviceId).toBe('dev-1')
    // No user was recorded, so the record must not carry one.
    expect('actorId' in back).toBe(false)
  })

  it('falls back to the channel that claims least, never to "sheet"', async () => {
    const document = await roundTrip(
      'documents',
      fromDocument({ companyId: COMPANY, type: 'invoice', status: 'issued', currency: 'NGN', totalMinor: 0 }),
    )
    const back = toShareEvent(
      await roundTrip(
        'audit_log',
        fromShareEvent({
          companyId: COMPANY,
          action: 'share_failed',
          entity: 'document',
          recordId: String(document['id']),
          at: '2026-09-13T09:00:00.000Z',
        }),
      ),
    )
    expect(back.channel).toBe('none')
  })

  it('round-trips a credit note, with a currency of its own (Rule #3)', async () => {
    const invoice = await roundTrip(
      'documents',
      fromDocument({ companyId: COMPANY, type: 'invoice', status: 'issued', currency: 'GHS', totalMinor: 90_000 }),
    )
    const back = toCreditNote(
      await roundTrip(
        'credit_notes',
        fromCreditNote({
          companyId: COMPANY,
          invoiceId: String(invoice['id']),
          amount: money('GHS', 25_000),
          reference: 'CN-0001',
          reason: 'Two bags short',
          issuedAt: '2026-09-13T09:00:00.000Z',
          invoiceReference: 'INV-0007',
          invoiceTotal: money('GHS', 90_000),
        }),
      ),
    )

    expect(back.amount).toEqual(money('GHS', 25_000))
    expect(back.reason).toBe('Two bags short')
    // The snapshot says what was credited, as it was — not a live link to a
    // document that may since have been voided (Rule #5).
    expect(back.invoiceReference).toBe('INV-0007')
    expect(back.invoiceTotal).toEqual(money('GHS', 90_000))
  })

  it('round-trips a link token, storing only the hash (§P)', async () => {
    const document = await roundTrip(
      'documents',
      fromDocument({ companyId: COMPANY, type: 'quotation', status: 'sent', currency: 'NGN', totalMinor: 0 }),
    )
    const row = await roundTrip(
      'document_signing_tokens',
      fromLinkToken({
        documentId: String(document['id']),
        companyId: COMPANY,
        tokenHash: 'a'.repeat(64),
        expiresAt: '2026-09-27T00:00:00.000Z',
      }),
    )
    const back = toLinkToken(row)
    expect(back.tokenHash).toBe('a'.repeat(64))
    expect(back.consumedAt).toBeUndefined()
    // The secret itself is nowhere in the row.
    expect(Object.values(row).join(' ')).not.toContain('GOODTOKEN')
  })
})
