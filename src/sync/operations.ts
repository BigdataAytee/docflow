/**
 * The unit of sync (§M).
 *
 * "Local change + pending upload persist atomically; every operation carries
 * an idempotency key, entity version, actor and device ID."
 *
 * All four are required, not optional, because each one prevents a specific
 * failure: the key stops a retry duplicating, the version detects a concurrent
 * edit, the actor decides who may resolve a conflict, and the device id
 * qualifies an offline reference and identifies a revoked device.
 */

export type Entity =
  | 'company' | 'customer' | 'document' | 'payment' | 'payment_allocation'
  | 'credit_note' | 'item' | 'expense' | 'asset'
  /**
   * A sharing handoff (§M, §E `audit_log`). Added in Phase 4, when the SQLite
   * repositories made every mutation enqueue an operation and a share turned
   * out to be the one record with nothing here to call itself. Recording it as
   * `asset` would have put a handoff in the asset stream on the server.
   */
  | 'share_event'
  /**
   * A monthly repeat (§L4). The SCHEDULE, not the drafts it produces — those
   * are ordinary documents and sync as documents. Without its own entity a
   * schedule would have to travel as one, and a server reading the document
   * stream would find a row with no line items and no total.
   */
  | 'recurrence'

export type OperationKind = 'create' | 'update' | 'delete'

export interface Operation {
  readonly id: string
  readonly entity: Entity
  readonly recordId: string
  readonly kind: OperationKind
  readonly payload: Readonly<Record<string, unknown>>
  /** Retrying with the same key is a no-op server-side (§M). */
  readonly idempotencyKey: string
  /** The record version this change was made against. Not a timestamp (§M). */
  readonly baseVersion: number
  readonly actorId: string
  readonly deviceId: string
  readonly createdAt: string
  /**
   * Operations that must be acknowledged before this one is sent. §M: "Parents
   * and assets resolve before dependents become externally visible."
   */
  readonly dependsOn?: readonly string[]
}

export type OperationState =
  | 'pending'
  | 'in_flight'
  /** Acknowledged by the SERVER — not merely sent (§M). */
  | 'uploaded'
  | 'failed'

export interface QueuedOperation {
  readonly operation: Operation
  readonly state: OperationState
  readonly attempts: number
  readonly nextAttemptAt?: string
  /** Actionable, per-record, and safe to retry (§M). */
  readonly lastError?: string
}

export class SyncError extends Error {}

export function assertWellFormed(operation: Operation): void {
  const missing = (['idempotencyKey', 'actorId', 'deviceId'] as const).filter(
    (field) => operation[field].trim() === '',
  )
  if (missing.length > 0) {
    throw new SyncError(
      `An operation needs ${missing.join(', ')}. Each one prevents a specific failure, so none of them is optional (v6 §M).`,
    )
  }
  if (!Number.isInteger(operation.baseVersion) || operation.baseVersion < 0) {
    throw new SyncError('An operation carries the record version it was made against (v6 §M).')
  }
}

/**
 * Exponential backoff with jitter (§M: "Retry with backoff on connectivity /
 * foreground"). Capped so a long-failing operation still retries occasionally
 * rather than drifting into never.
 */
const BASE_DELAY_MS = 2_000
const MAX_DELAY_MS = 5 * 60_000

export function backoffMs(attempts: number, random = Math.random): number {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1))
  // Jitter spreads a fleet of devices that all came back online together.
  return Math.round(exponential * (0.5 + random() * 0.5))
}

/**
 * The operations ready to send: pending, not blocked by an unacknowledged
 * dependency, and past their backoff.
 */
export function readyToSend(
  queue: readonly QueuedOperation[],
  now: string,
): QueuedOperation[] {
  const acknowledged = new Set(
    queue.filter((q) => q.state === 'uploaded').map((q) => q.operation.id),
  )

  return queue.filter((entry) => {
    if (entry.state !== 'pending' && entry.state !== 'failed') return false
    if (entry.nextAttemptAt !== undefined && entry.nextAttemptAt > now) return false
    // A dependent waits for its parent to be acknowledged, so a document never
    // becomes visible before the customer it names (§M).
    return (entry.operation.dependsOn ?? []).every((id) => acknowledged.has(id))
  })
}
