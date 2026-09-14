/**
 * The outbox, on disk (§M, CLAUDE.md, §Q Phase 4).
 *
 * `src/sync/outbox.ts` holds the in-memory `Outbox` the chaos suite drives.
 * This is the same queue in a SQLite table, and it exists because of one line
 * in CLAUDE.md that nothing before Phase 4 could actually keep:
 *
 *   "Every mobile mutation = record write + outbox enqueue in ONE SQLite
 *    transaction. A failed commit must not show 'Saved'."
 *
 * Until there was a SQLite database there was no transaction to share, so the
 * record write and the enqueue were two steps with a gap between them. A crash
 * in that gap loses the upload while the screen says Saved — the phone keeps a
 * payment the server never hears about, and the owner has no way to know. The
 * whole point of this file is that `enqueueIn` takes a `SqlTransaction` it did
 * not open and cannot commit: an enqueue is only ever a participant in
 * somebody else's write, never a write of its own.
 *
 * This is NOT a second replay engine (§M forbids two). It is the same outbox
 * design, durable; `drain` and the backoff rules still live in `src/sync` and
 * are imported, not restated.
 */

import {
  type Operation,
  type OperationState,
  type QueuedOperation,
  assertWellFormed,
  backoffMs,
  readyToSend,
} from '../../sync/operations'
import type { SqlDriver, SqlRow, SqlTransaction } from './driver'

const toOperation = (row: SqlRow): QueuedOperation => {
  const dependsOn =
    typeof row['depends_on'] === 'string' && row['depends_on'] !== ''
      ? (JSON.parse(row['depends_on']) as string[])
      : undefined

  const operation: Operation = {
    id: String(row['id']),
    entity: String(row['entity']) as Operation['entity'],
    recordId: String(row['record_id']),
    kind: String(row['kind']) as Operation['kind'],
    payload: JSON.parse(String(row['payload'] ?? '{}')) as Record<string, unknown>,
    idempotencyKey: String(row['idempotency_key']),
    baseVersion: Number(row['base_version']),
    actorId: String(row['actor_id']),
    deviceId: String(row['device_id']),
    createdAt: String(row['created_at']),
    ...(dependsOn === undefined ? {} : { dependsOn }),
  }

  return {
    operation,
    state: String(row['state']) as OperationState,
    attempts: Number(row['attempts']),
    ...(typeof row['next_attempt_at'] === 'string' ? { nextAttemptAt: row['next_attempt_at'] } : {}),
    ...(typeof row['last_error'] === 'string' ? { lastError: row['last_error'] } : {}),
  }
}

/**
 * Add an operation to the queue inside a transaction somebody else opened.
 *
 * It takes a `SqlTransaction` it did not open and cannot commit: an enqueue is
 * only ever a participant in somebody else's write, never a write of its own.
 *
 * A replayed idempotency key hits the UNIQUE index and throws, which aborts
 * the caller's whole transaction — record write included. That is the correct
 * outcome and not a hazard: the repositories check `mutation_log` first and
 * return the original record without reaching here, so an exception at this
 * point means two DIFFERENT writes claimed one key, and neither should land.
 */
export async function enqueueIn(tx: SqlTransaction, operation: Operation): Promise<void> {
  assertWellFormed(operation)

  await tx.run(
    `insert into outbox (
       id, entity, record_id, kind, payload, idempotency_key, base_version,
       actor_id, device_id, created_at, depends_on, state, attempts, sequence
     ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0,
       (select coalesce(max(sequence), 0) + 1 from outbox))`,
    [
      operation.id,
      operation.entity,
      operation.recordId,
      operation.kind,
      JSON.stringify(operation.payload),
      operation.idempotencyKey,
      operation.baseVersion,
      operation.actorId,
      operation.deviceId,
      operation.createdAt,
      operation.dependsOn === undefined ? null : JSON.stringify(operation.dependsOn),
    ],
  )
}

/**
 * The queue as the sync loop sees it.
 *
 * Every method is a fresh read of the table rather than a cached array: the
 * app can be killed between any two of them (§Q's "force-kill mid-drain"), and
 * a queue that trusted its own memory would come back believing an operation
 * was in flight that nothing is flying.
 */
export class SqliteQueue {
  constructor(private readonly driver: SqlDriver) {}

  private async select(where: string, params: readonly string[] = []): Promise<QueuedOperation[]> {
    const rows = await this.driver.all(
      `select * from outbox ${where} order by sequence asc`,
      params,
    )
    return rows.map(toOperation)
  }

  all(): Promise<QueuedOperation[]> {
    return this.select('')
  }

  /** Everything still owed to the server. */
  pending(): Promise<QueuedOperation[]> {
    return this.select("where state != 'uploaded'")
  }

  failed(): Promise<QueuedOperation[]> {
    return this.select("where state = 'failed'")
  }

  /**
   * Which operations may be sent now.
   *
   * The dependency and backoff rules come from `src/sync/operations` rather
   * than a WHERE clause, so the durable queue and the in-memory one the chaos
   * suite drives cannot drift apart on the question of what is ready.
   */
  async ready(now: string): Promise<QueuedOperation[]> {
    return readyToSend(await this.all(), now)
  }

  async markInFlight(id: string): Promise<void> {
    await this.driver.transaction(async (tx) => {
      await tx.run("update outbox set state = 'in_flight' where id = ?", [id])
    })
  }

  /**
   * The server acknowledged it. This — and only this — completes an upload
   * (§M: "Server acknowledgement, not network availability").
   *
   * The row stays. A key the server has already accepted must still be
   * recognisable as accepted when the same operation is replayed after a
   * crash, and a deleted row would look like an operation that never happened.
   */
  async markUploaded(id: string): Promise<void> {
    await this.driver.transaction(async (tx) => {
      await tx.run("update outbox set state = 'uploaded', last_error = null where id = ?", [id])
    })
  }

  /** A failure keeps the operation, with an actionable error and a retry time (§M). */
  async markFailed(id: string, error: string, now: string, random?: () => number): Promise<void> {
    await this.driver.transaction(async (tx) => {
      const row = await tx.get('select attempts from outbox where id = ?', [id])
      const attempts = Number(row?.['attempts'] ?? 0) + 1
      const nextAttemptAt = new Date(
        new Date(now).getTime() + backoffMs(attempts, random),
      ).toISOString()
      await tx.run(
        "update outbox set state = 'failed', attempts = ?, last_error = ?, next_attempt_at = ? where id = ?",
        [attempts, error, nextAttemptAt, id],
      )
    })
  }

  /** The durable pull cursor (§M): advances only after a transactional apply. */
  async cursor(): Promise<string | null> {
    const row = await this.driver.get("select value from sync_state where key = 'pull_cursor'")
    return typeof row?.['value'] === 'string' ? row['value'] : null
  }

  /**
   * Takes a transaction it did not open, for the same reason `enqueueIn`
   * does. §M: the cursor "advances only after transactional application", so
   * it must move in the SAME commit as the rows it accounts for, never in one
   * of its own.
   */
  async advanceCursor(tx: SqlTransaction, cursor: string): Promise<void> {
    await tx.run(
      "insert into sync_state (key, value) values ('pull_cursor', ?) " +
        'on conflict(key) do update set value = excluded.value',
      [cursor],
    )
  }
}
