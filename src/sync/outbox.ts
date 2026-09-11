/**
 * The durable outbox (§C, §M).
 *
 * §C: "PowerSync preferred; hand-rolled durable outbox as the single fallback
 * (never both)." The decision is recorded in PLAN.md: PowerSync cannot be
 * validated without the encrypted SQLite build on a device (§W), so this is
 * built now and PowerSync is a Phase 4 evaluation. If it passes, this is
 * REMOVED — not run alongside, because two replay engines is exactly what §M
 * rules out.
 *
 * The rules this exists to keep:
 *  · the record write and its outbox entry commit together or not at all;
 *  · an operation is uploaded when the SERVER says so, never when the network
 *    merely looked available;
 *  · a retried operation never produces a second record.
 */

import {
  type Operation,
  type QueuedOperation,
  SyncError,
  assertWellFormed,
  backoffMs,
  readyToSend,
} from './operations'

/** The one transaction §C demands: a record write plus its outbox entry. */
export interface Transaction<T> {
  readonly write: () => T
  readonly operation: Operation
}

export interface CommitResult<T> {
  readonly record: T
  readonly queued: QueuedOperation
}

export class Outbox {
  private entries: QueuedOperation[] = []

  /**
   * Commit a mutation and its pending upload atomically.
   *
   * If the write throws, nothing is queued — §C: "A failed commit must not
   * show 'Saved'." If queueing throws, the write is not reported either.
   */
  commit<T>(transaction: Transaction<T>): CommitResult<T> {
    assertWellFormed(transaction.operation)

    const existing = this.entries.find(
      (entry) => entry.operation.idempotencyKey === transaction.operation.idempotencyKey,
    )
    if (existing !== undefined) {
      // A replayed commit re-runs nothing. The caller gets the original.
      throw new SyncError(
        `Operation ${transaction.operation.idempotencyKey} is already queued. A retry must not create a second record (v6 §M).`,
      )
    }

    const snapshot = [...this.entries]
    let record: T
    try {
      record = transaction.write()
      this.entries = [
        ...this.entries,
        { operation: transaction.operation, state: 'pending', attempts: 0 },
      ]
    } catch (error) {
      // Both halves roll back together.
      this.entries = snapshot
      throw error
    }

    const queued = this.entries[this.entries.length - 1]
    if (queued === undefined) throw new SyncError('Unreachable: nothing queued.')
    return { record, queued }
  }

  /** Everything still owed to the server. */
  pending(): QueuedOperation[] {
    return this.entries.filter((entry) => entry.state !== 'uploaded')
  }

  failed(): QueuedOperation[] {
    return this.entries.filter((entry) => entry.state === 'failed')
  }

  all(): QueuedOperation[] {
    return [...this.entries]
  }

  ready(now: string): QueuedOperation[] {
    return readyToSend(this.entries, now)
  }

  private replace(id: string, next: QueuedOperation): void {
    this.entries = this.entries.map((entry) => (entry.operation.id === id ? next : entry))
  }

  markInFlight(id: string): void {
    const entry = this.require(id)
    this.replace(id, { ...entry, state: 'in_flight' })
  }

  /**
   * The server acknowledged it. This — and only this — completes an upload
   * (§M: "Server acknowledgement, not network availability").
   */
  markUploaded(id: string): void {
    const entry = this.require(id)
    this.replace(id, { ...entry, state: 'uploaded', attempts: entry.attempts })
  }

  /** A failure keeps the operation, with an actionable error and a retry time. */
  markFailed(id: string, error: string, now: string, random?: () => number): void {
    const entry = this.require(id)
    const attempts = entry.attempts + 1
    this.replace(id, {
      ...entry,
      state: 'failed',
      attempts,
      lastError: error,
      nextAttemptAt: new Date(Date.parse(now) + backoffMs(attempts, random)).toISOString(),
    })
  }

  /**
   * Restore a queue from storage after a restart. An operation that was
   * in flight when the app died goes back to pending: the server may or may
   * not have applied it, and the idempotency key makes resending safe (§M).
   */
  static restore(entries: readonly QueuedOperation[]): Outbox {
    const outbox = new Outbox()
    outbox.entries = entries.map((entry) =>
      entry.state === 'in_flight' ? { ...entry, state: 'pending' } : { ...entry },
    )
    return outbox
  }

  private require(id: string): QueuedOperation {
    const entry = this.entries.find((e) => e.operation.id === id)
    if (entry === undefined) throw new SyncError(`No queued operation ${id}.`)
    return entry
  }
}

export type SendOutcome =
  | { readonly ok: true }
  /** The server already had this key — an earlier attempt landed after all. */
  | { readonly ok: true; readonly duplicate: true }
  | { readonly ok: false; readonly error: string }

/**
 * Drain the queue. The sender is injected so the chaos suite can kill it
 * mid-flight, duplicate it, or fail it deterministically.
 */
export async function drain(
  outbox: Outbox,
  send: (operation: Operation) => Promise<SendOutcome>,
  now: string,
  random?: () => number,
): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0
  let failed = 0
  const attempted = new Set<string>()

  // Loop rather than iterate a snapshot: acknowledging a parent unblocks its
  // dependents, and making them wait for the next drain would delay a document
  // becoming visible for no reason. `attempted` bounds the loop, so a
  // permanently blocked dependency cannot spin.
  for (;;) {
    const batch = outbox.ready(now).filter((entry) => !attempted.has(entry.operation.id))
    if (batch.length === 0) break

    for (const entry of batch) {
      attempted.add(entry.operation.id)
      outbox.markInFlight(entry.operation.id)
      try {
        const outcome = await send(entry.operation)
        if (outcome.ok) {
          outbox.markUploaded(entry.operation.id)
          uploaded += 1
        } else {
          outbox.markFailed(entry.operation.id, outcome.error, now, random)
          failed += 1
        }
      } catch (error) {
        // A thrown sender — a dropped connection mid-request — is a failure,
        // not an upload. The operation stays owed.
        outbox.markFailed(
          entry.operation.id,
          error instanceof Error ? error.message : String(error),
          now,
          random,
        )
        failed += 1
      }
    }
  }

  return { uploaded, failed }
}
