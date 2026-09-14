/**
 * Transactions do not interleave (§Q Phase 4).
 *
 * The port originally took a SYNCHRONOUS transaction body, to make it
 * impossible to `await` between two statements and let somebody else's
 * statement land inside the transaction. The reasoning was right; the
 * mechanism could not survive a phone, where the Capacitor bridge is one async
 * call per statement.
 *
 * So the guarantee moved from the type to the driver — transactions serialise
 * on a queue — and these are the tests that say it is still a guarantee. They
 * are the reason the change was safe rather than a quiet weakening.
 */

import { describe, expect, it } from 'vitest'

import { createSerialiser } from './driver'
import { migrate } from './migrate'
import { createNodeDriver } from './node'

describe('createSerialiser', () => {
  it('runs bodies one after another, never overlapping', async () => {
    const serialise = createSerialiser()
    const log: string[] = []

    const slow = (name: string, ms: number) =>
      serialise(async () => {
        log.push(`${name}:start`)
        await new Promise((resolve) => setTimeout(resolve, ms))
        log.push(`${name}:end`)
      })

    // B is started while A is still sleeping. Without the queue its `start`
    // would land between A's start and end.
    await Promise.all([slow('a', 20), slow('b', 1)])

    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end'])
  })

  it('is not poisoned by a failure', async () => {
    const serialise = createSerialiser()
    // A rolled-back transaction is an ordinary outcome here — a refused edit
    // to an issued document is a rollback, not a fault — so the next caller
    // must still run.
    await expect(serialise(async () => Promise.reject(new Error('nope')))).rejects.toThrow('nope')
    await expect(serialise(async () => 'after')).resolves.toBe('after')
  })
})

describe('Two concurrent transactions on one connection', () => {
  it('commit one after the other rather than into each other', async () => {
    const driver = createNodeDriver(':memory:')
    await migrate(driver)

    // Each transaction reads the count and writes count+1 rows. Interleaved,
    // both would read 0 and the second would clobber the first's work; the
    // SQLite engine would also refuse a nested BEGIN outright.
    const bump = (id: string) =>
      driver.transaction(async (tx) => {
        const before = await tx.get('select count(*) as n from assets')
        const n = Number(before?.['n'] ?? 0)
        await new Promise((resolve) => setTimeout(resolve, 5))
        await tx.run(
          "insert into assets (id, company_id, kind, data_url, created_at) values (?, 'co', 'signature', 'data:,', '2026-09-14')",
          [id],
        )
        return n
      })

    const seen = await Promise.all([bump('a'), bump('b')])

    // The second saw the first's row, which is only possible if the first had
    // already committed.
    expect(seen.sort()).toEqual([0, 1])
    const after = await driver.get('select count(*) as n from assets')
    expect(Number(after?.['n'])).toBe(2)
    await driver.close()
  })

  it('rolls one back without taking the other with it', async () => {
    const driver = createNodeDriver(':memory:')
    await migrate(driver)

    const good = driver.transaction(async (tx) => {
      await tx.run(
        "insert into assets (id, company_id, kind, data_url, created_at) values ('ok', 'co', 'signature', 'data:,', '2026-09-14')",
      )
    })
    const bad = driver.transaction(async (tx) => {
      await tx.run(
        "insert into assets (id, company_id, kind, data_url, created_at) values ('bad', 'co', 'signature', 'data:,', '2026-09-14')",
      )
      throw new Error('changed my mind')
    })

    await good
    await expect(bad).rejects.toThrow('changed my mind')

    const rows = await driver.all('select id from assets')
    expect(rows.map((row) => row['id'])).toEqual(['ok'])
    await driver.close()
  })
})
