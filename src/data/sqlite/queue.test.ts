/**
 * The one transaction (§M, CLAUDE.md, §Q Phase 4).
 *
 *   "Every mobile mutation = record write + outbox enqueue in ONE SQLite
 *    transaction. A failed commit must not show 'Saved'."
 *
 * That line has been in CLAUDE.md since Phase 0 and could not be true until
 * now: there was no SQLite, so `src/sync/outbox.ts` had no transaction to join
 * and was exercised only by its own tests, never by a repository. These tests
 * are the first time the invariant is checked end to end — a real mutation
 * through a real repository, against a real database.
 *
 * What each case is really asking:
 *
 *  · does a saved record ALWAYS have a pending upload behind it?
 *  · when the enqueue fails, does the record go with it — or does the screen
 *    say Saved over a row the server will never hear about?
 *  · does a replayed tap add a second operation to the queue?
 */

import { describe, expect, it } from 'vitest'

import { RepositoryError } from '../repositories/types'
import { migrate } from './migrate'
import { createNodeDriver } from './node'
import { SqliteQueue } from './queue'
import { createSqliteRepositories } from './repositories'

const COMPANY = 'co_acme'

const store = async () => {
  const driver = createNodeDriver(':memory:')
  await migrate(driver)
  await driver.transaction(async (tx) => {
    tx.run(
      `insert into companies (id, name, locale_region, locale_language, currency)
       values (?, 'Acme', 'NG', 'en', 'NGN')`,
      [COMPANY],
    )
  })
  let counter = 0
  return {
    driver,
    queue: new SqliteQueue(driver),
    repositories: createSqliteRepositories(driver, {
      newId: (prefix) => `${prefix}_${(++counter).toString(36)}`,
      now: () => '2026-09-14T00:00:00.000Z',
    }),
  }
}

const customer = { companyId: COMPANY, kind: 'person' as const, name: 'Okoro', labels: [] }

describe('A saved record always has its upload behind it', () => {
  it('enqueues an operation for a created customer', async () => {
    const { repositories, queue, driver } = await store()
    const created = await repositories.customers.create(customer, {
      idempotencyKey: 'k1',
      actorId: 'user_1',
      deviceId: 'dev_1',
    })

    const pending = await queue.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.operation.entity).toBe('customer')
    expect(pending[0]?.operation.recordId).toBe(created.id)
    expect(pending[0]?.operation.kind).toBe('create')
    // §M: the key, the actor and the device are all carried, because each one
    // prevents a different failure.
    expect(pending[0]?.operation.idempotencyKey).toBe('k1')
    expect(pending[0]?.operation.actorId).toBe('user_1')
    expect(pending[0]?.operation.deviceId).toBe('dev_1')
    await driver.close()
  })

  it('enqueues exactly one operation however often the tap is replayed', async () => {
    const { repositories, queue, driver } = await store()
    for (const _ of [1, 2, 3]) {
      await repositories.customers.create(customer, { idempotencyKey: 'k1' })
    }
    expect(await queue.pending()).toHaveLength(1)
    expect(await repositories.customers.list(COMPANY)).toHaveLength(1)
    await driver.close()
  })

  it('records a document as depending on the customer it names (§M)', async () => {
    const { repositories, queue, driver } = await store()
    const person = await repositories.customers.create(customer, { idempotencyKey: 'k1' })
    await repositories.documents.createDraft(
      {
        companyId: COMPANY,
        type: 'invoice',
        status: 'draft',
        currency: 'NGN',
        customerId: person.id,
        lineItems: [],
        totalMinor: 0,
      },
      { idempotencyKey: 'k2' },
    )

    const queued = await queue.all()
    const document = queued.find((entry) => entry.operation.entity === 'document')
    // "Parents and assets resolve before dependents become externally
    // visible" — so the document cannot be sent before its customer lands.
    expect(document?.operation.dependsOn).toEqual([person.id])
    await driver.close()
  })
})

describe('A failed commit must not show "Saved"', () => {
  it('rolls the record back when the enqueue fails', async () => {
    const { repositories, driver, queue } = await store()

    // Two DIFFERENT writes claiming one key. The first is legitimate; the
    // second is a bug or a race, and the UNIQUE index on the outbox is what
    // catches it. The record must not survive its own failed upload.
    await repositories.customers.create(customer, { idempotencyKey: 'k1' })
    await driver.transaction(async (tx) => {
      // Forget the key ever happened, keeping the outbox row — the shape a
      // corrupted store takes, and the only way to reach the enqueue guard
      // through the public API.
      tx.run('delete from mutation_log where idempotency_key = ?', ['k1'])
    })

    await expect(
      repositories.customers.create({ ...customer, name: 'Someone Else' }, { idempotencyKey: 'k1' }),
    ).rejects.toBeInstanceOf(RepositoryError)

    // One customer, one operation. The second write left nothing behind.
    expect(await repositories.customers.list(COMPANY)).toHaveLength(1)
    expect(await repositories.customers.list(COMPANY)).toEqual([
      expect.objectContaining({ name: 'Okoro' }),
    ])
    expect(await queue.all()).toHaveLength(1)
    await driver.close()
  })

  it('queues nothing when the write itself is refused', async () => {
    const { repositories, queue, driver } = await store()
    await expect(
      repositories.customers.update('cus_missing', { name: 'Ghost' }, { idempotencyKey: 'k1' }),
    ).rejects.toBeInstanceOf(RepositoryError)
    expect(await queue.all()).toHaveLength(0)
    await driver.close()
  })

  it('refuses a mutation with no idempotency key rather than queueing one', async () => {
    const { repositories, queue, driver } = await store()
    await expect(
      repositories.customers.create(customer, { idempotencyKey: '  ' }),
    ).rejects.toBeInstanceOf(RepositoryError)
    expect(await queue.all()).toHaveLength(0)
    expect(await repositories.customers.list(COMPANY)).toHaveLength(0)
    await driver.close()
  })
})

describe('The queue survives being killed (§Q Phase 3)', () => {
  it('reads its state from the table, never from memory', async () => {
    const { repositories, driver } = await store()
    await repositories.customers.create(customer, { idempotencyKey: 'k1' })

    // A second queue object over the same database is what a cold start after
    // a force-kill looks like: nothing cached, everything re-read.
    const afterRestart = new SqliteQueue(driver)
    expect(await afterRestart.pending()).toHaveLength(1)
    await driver.close()
  })

  it('leaves an acknowledged operation recognisable after a restart', async () => {
    const { repositories, queue, driver } = await store()
    await repositories.customers.create(customer, { idempotencyKey: 'k1' })
    const [entry] = await queue.pending()
    await queue.markUploaded(entry?.operation.id ?? '')

    const afterRestart = new SqliteQueue(driver)
    expect(await afterRestart.pending()).toHaveLength(0)
    // Still there, still readable: a deleted row would look like an operation
    // that never happened, and a replay after a crash could send it twice.
    expect(await afterRestart.all()).toHaveLength(1)
    expect((await afterRestart.all())[0]?.state).toBe('uploaded')
    await driver.close()
  })

  it('keeps a failed operation with its error and a retry time (§M)', async () => {
    const { repositories, queue, driver } = await store()
    await repositories.customers.create(customer, { idempotencyKey: 'k1' })
    const [entry] = await queue.pending()
    await queue.markFailed(
      entry?.operation.id ?? '',
      'The server was unreachable.',
      '2026-09-14T00:00:00.000Z',
      () => 0.5,
    )

    const [failed] = await queue.failed()
    expect(failed?.attempts).toBe(1)
    expect(failed?.lastError).toBe('The server was unreachable.')
    expect(failed?.nextAttemptAt).toBeDefined()
    // Not ready yet: backoff is honoured by the same function the in-memory
    // queue uses, so the two cannot drift apart about what is sendable.
    expect(await queue.ready('2026-09-14T00:00:00.000Z')).toHaveLength(0)
    expect(await queue.ready('2026-09-14T01:00:00.000Z')).toHaveLength(1)
    await driver.close()
  })
})
