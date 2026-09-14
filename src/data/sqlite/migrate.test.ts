/**
 * The schema, against real SQLite (§Q Phase 4).
 *
 * These are not tests of the repositories — those are the contract suite. They
 * test the things the SCHEMA promises on its own, because each one has to hold
 * against a write that does not come through a repository at all: a sync
 * applying a server row, a repair script, a future migration. Rule #5 is only
 * as strong as its weakest writer.
 */

import { describe, expect, it } from 'vitest'

import { SqlError } from './driver'
import { migrate } from './migrate'
import { createNodeDriver } from './node'
import { SCHEMA_VERSION } from './schema'

const fresh = async () => {
  const driver = createNodeDriver(':memory:')
  await migrate(driver)
  return driver
}

const insertDocument = (
  tx: { run: (sql: string, params?: readonly (string | number | null)[]) => void },
  overrides: Record<string, string | number | null> = {},
) => {
  const row: Record<string, string | number | null> = {
    id: 'doc_1',
    company_id: 'co_acme',
    type: 'invoice',
    status: 'draft',
    currency: 'NGN',
    total_minor: 150_000,
    issued_reference: null,
    frozen_labels: null,
    signer_name: null,
    signed_at: null,
    ...overrides,
  }
  const columns = Object.keys(row)
  tx.run(
    `insert into documents (${columns.join(', ')}) values (${columns.map(() => '?').join(', ')})`,
    columns.map((column) => row[column] as string | number | null),
  )
}

describe('migrate', () => {
  it('creates the schema and records the version in the file header', async () => {
    const driver = await fresh()
    const version = await driver.get('pragma user_version')
    expect(Number(version?.['user_version'])).toBe(SCHEMA_VERSION)
    await driver.close()
  })

  it('is idempotent — a second run changes nothing', async () => {
    const driver = await fresh()
    await expect(migrate(driver)).resolves.toBe(SCHEMA_VERSION)
    await driver.close()
  })

  it('creates the triggers, not only the tables', async () => {
    const driver = await fresh()
    const triggers = await driver.all("select name from sqlite_master where type = 'trigger'")
    expect(triggers.map((row) => row['name']).sort()).toEqual([
      'documents_evidence_is_sealed',
      'documents_labels_are_frozen',
      'documents_reference_is_frozen',
    ])
    await driver.close()
  })

  it('refuses a database written by a newer build rather than downgrading it', async () => {
    const driver = createNodeDriver(':memory:')
    await driver.execute(`pragma user_version = ${SCHEMA_VERSION + 5}`)
    await expect(migrate(driver)).rejects.toBeInstanceOf(SqlError)
    await expect(migrate(driver)).rejects.toThrow(/newer version of DocFlow/)
    await driver.close()
  })
})

describe('The schema enforces Rule #5 beneath the repositories', () => {
  it('refuses to change an issued reference', async () => {
    const driver = await fresh()
    await driver.transaction((tx) => insertDocument(tx, { issued_reference: 'INV-0001' }))

    await expect(
      driver.transaction((tx) =>
        tx.run('update documents set issued_reference = ? where id = ?', ['INV-0002', 'doc_1']),
      ),
    ).rejects.toThrow(/frozen at issue/)

    const after = await driver.get('select issued_reference from documents where id = ?', ['doc_1'])
    expect(after?.['issued_reference']).toBe('INV-0001')
    await driver.close()
  })

  it('refuses to change frozen labels', async () => {
    const driver = await fresh()
    await driver.transaction((tx) => insertDocument(tx, { frozen_labels: '{"typeName":"Invoice"}' }))

    await expect(
      driver.transaction((tx) =>
        tx.run('update documents set frozen_labels = ? where id = ?', ['{"typeName":"Waybill"}', 'doc_1']),
      ),
    ).rejects.toThrow(/fixed at issue/)
    await driver.close()
  })

  it('allows the FIRST write of a reference — freezing is not forbidding', async () => {
    const driver = await fresh()
    await driver.transaction((tx) => insertDocument(tx))
    await driver.transaction((tx) =>
      tx.run('update documents set issued_reference = ? where id = ?', ['INV-0001', 'doc_1']),
    )
    const after = await driver.get('select issued_reference from documents where id = ?', ['doc_1'])
    expect(after?.['issued_reference']).toBe('INV-0001')
    await driver.close()
  })

  it('seals delivery evidence once signed', async () => {
    const driver = await fresh()
    await driver.transaction((tx) =>
      insertDocument(tx, {
        type: 'delivery',
        signer_name: 'Bisi Adeyemi',
        signed_at: '2026-09-12T14:30:00Z',
      }),
    )

    await expect(
      driver.transaction((tx) =>
        tx.run('update documents set signer_name = ? where id = ?', ['Someone Else', 'doc_1']),
      ),
    ).rejects.toThrow(/sealed once signed/)
    await driver.close()
  })
})

describe('The schema enforces Rule #3 — money is never a float', () => {
  it('refuses a fractional amount in a money column', async () => {
    const driver = await fresh()
    await expect(
      driver.transaction((tx) => insertDocument(tx, { total_minor: 1500.5 })),
    ).rejects.toThrow()
    await driver.close()
  })
})

describe('A transaction is all or nothing', () => {
  it('rolls the record write back when the outbox enqueue fails', async () => {
    const driver = await fresh()

    await expect(
      driver.transaction((tx) => {
        insertDocument(tx)
        // A NOT NULL column left out: the enqueue half fails.
        tx.run('insert into outbox (id) values (?)', ['op_1'])
      }),
    ).rejects.toThrow()

    // "A failed commit must not show Saved" (CLAUDE.md).
    const documents = await driver.all('select id from documents')
    expect(documents).toHaveLength(0)
    await driver.close()
  })

  it('refuses a second operation carrying a key already queued', async () => {
    const driver = await fresh()
    const enqueue = (id: string, key: string) =>
      driver.transaction((tx) =>
        tx.run(
          `insert into outbox (id, entity, record_id, kind, payload, idempotency_key,
             base_version, actor_id, device_id, created_at, sequence)
           values (?, 'document', 'doc_1', 'create', '{}', ?, 0, 'user', 'dev', '2026-09-14T00:00:00Z', 1)`,
          [id, key],
        ),
      )

    await enqueue('op_1', 'key-a')
    await expect(enqueue('op_2', 'key-a')).rejects.toThrow(/UNIQUE/i)
    await driver.close()
  })
})
