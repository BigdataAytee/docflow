/**
 * The shape of every mutation in the SQLite layer (§M, CLAUDE.md).
 *
 * One function, used by all eleven repositories, because the invariant it
 * keeps is the same for all of them and a rule re-typed eleven times is a rule
 * that will hold in ten places:
 *
 *   record write + outbox enqueue, in ONE transaction, exactly once per
 *   idempotency key.
 *
 * "Exactly once" is the part worth reading carefully. A replayed key must
 * return the record the FIRST attempt produced — not a second record, and not
 * a fresh object built from the same inputs. So the key is written to
 * `mutation_log` inside the same commit as the row it names, and a replay
 * reads the row back by that log entry. If the first attempt's transaction
 * rolled back, neither the log entry nor the row exists, and the retry is a
 * genuine first attempt rather than a lookup that finds a ghost.
 *
 * This is also the first place in the build where CLAUDE.md's "ONE SQLite
 * transaction" is actually true rather than intended: before Phase 4 there was
 * no SQLite, so the `Outbox` in `src/sync` had no transaction to join and was
 * exercised only by its own tests. Recorded in PLAN.md rather than quietly
 * fixed.
 */

import { RepositoryError } from '../repositories/types'
import type { MutationContext } from '../repositories/types'
import type { Entity, Operation, OperationKind } from '../../sync/operations'
import { SqlError, type SqlDriver, type SqlRow, type SqlTransaction } from './driver'
import { enqueueIn } from './queue'

/** What a mutation needs to describe itself to the queue. */
export interface MutationPlan<T> {
  readonly entity: Entity
  readonly kind: OperationKind
  /** Runs inside the transaction. Returns the record as it now stands. */
  readonly write: (tx: SqlTransaction) => T
  /** The record's id, for the outbox row and the idempotency log. */
  readonly recordId: (record: T) => string
  /** The version this change was made against — not a timestamp (§M). */
  readonly baseVersion?: number
  /** Operations that must be acknowledged first (§M). */
  readonly dependsOn?: readonly string[]
}

export interface MutationDeps {
  readonly driver: SqlDriver
  /** Reads a record back by id, for a replayed key. */
  readonly now: () => string
  readonly newId: (prefix: string) => string
}

/**
 * Sync fields are REQUIRED on an operation (§M) but optional on a
 * `MutationContext`, because a screen calling `create` has no business knowing
 * about devices. The gap is filled here, once, with values that are honest
 * about being defaults rather than with empty strings that `assertWellFormed`
 * would reject at the worst possible moment — mid-commit.
 */
const LOCAL_ACTOR = 'local'

export async function mutate<T>(
  deps: MutationDeps,
  ctx: MutationContext,
  plan: MutationPlan<T>,
  readBack: (tx: SqlTransaction, id: string) => T | null,
): Promise<T> {
  if (ctx.idempotencyKey.trim() === '') {
    throw new RepositoryError('Every mutation carries an idempotency key (v6 §M).')
  }

  try {
    return await deps.driver.transaction((tx) => {
      // A replay returns what the first attempt produced. Inside the
      // transaction, so a concurrent replay cannot slip between the check and
      // the write.
      const seen = tx.get('select record_id from mutation_log where idempotency_key = ?', [
        ctx.idempotencyKey,
      ])
      if (seen !== null) {
        const existing = readBack(tx, String(seen['record_id']))
        if (existing !== null) return existing
        // The log says this key produced a record and the record is gone.
        // That is a corrupt store, not a retry: writing again would give the
        // key two answers.
        throw new RepositoryError(
          `Mutation ${ctx.idempotencyKey} was recorded but its record is missing. ` +
            'The local store is inconsistent; nothing has been changed.',
        )
      }

      const record = plan.write(tx)
      const id = plan.recordId(record)

      tx.run(
        'insert into mutation_log (idempotency_key, entity, record_id) values (?, ?, ?)',
        [ctx.idempotencyKey, plan.entity, id],
      )

      const operation: Operation = {
        id: deps.newId('op'),
        entity: plan.entity,
        recordId: id,
        kind: plan.kind,
        payload: record as Readonly<Record<string, unknown>>,
        idempotencyKey: ctx.idempotencyKey,
        baseVersion: plan.baseVersion ?? 0,
        actorId: ctx.actorId ?? LOCAL_ACTOR,
        deviceId: ctx.deviceId ?? LOCAL_ACTOR,
        createdAt: deps.now(),
        ...(plan.dependsOn === undefined ? {} : { dependsOn: plan.dependsOn }),
      }

      // If this throws, the record write above rolls back with it. That is the
      // whole contract: "A failed commit must not show Saved."
      enqueueIn(tx, operation)

      return record
    })
  } catch (cause) {
    // The UI knows `RepositoryError`. A raw SQL message would reach a toast.
    if (cause instanceof RepositoryError) throw cause
    if (cause instanceof SqlError) throw new RepositoryError(cause.message)
    throw cause
  }
}

/** `select * from <table> where id = ?`, mapped — the common read-back. */
export const readBackBy =
  <T>(table: string, map: (row: SqlRow) => T) =>
  (tx: SqlTransaction, id: string): T | null => {
    const row = tx.get(`select * from ${table} where id = ?`, [id])
    return row === null ? null : map(row)
  }
