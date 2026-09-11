/**
 * Applying changes from the server (§M).
 *
 * "A durable pull cursor advances only after transactional application."
 *
 * The cursor is the whole point: if it advanced before the batch was applied,
 * a crash between the two would lose changes silently and permanently, and
 * nothing downstream would ever notice. So the cursor moves last, and a
 * failure mid-batch leaves it exactly where it was — the batch is simply
 * fetched again.
 */

import { type Entity } from './operations'
import { type RecordVersion, type Resolution, resolve } from './conflicts'
import type { DocumentType } from '../domain/documents/types'

export interface IncomingRecord {
  readonly entity: Entity
  readonly recordId: string
  readonly version: number
  readonly fields: Readonly<Record<string, unknown>>
  readonly deletedAt?: string | null
  readonly updatedBy: string
  readonly documentType?: DocumentType
  readonly documentStatus?: string
}

export interface PullBatch {
  readonly records: readonly IncomingRecord[]
  /** Advanced only once the whole batch is applied (§M). */
  readonly cursor: string
}

export interface LocalStore {
  get(entity: Entity, recordId: string): RecordVersion | null
  put(entity: Entity, recordId: string, record: RecordVersion): void
}

export interface PullResult {
  readonly applied: number
  readonly conflicts: { readonly entity: Entity; readonly recordId: string; readonly resolution: Resolution }[]
  readonly rejected: number
  /** Null when the batch failed — the caller keeps its previous cursor. */
  readonly cursor: string | null
}

export class PullError extends Error {}

/**
 * Apply a batch transactionally. `commit` is injected so a caller can wrap the
 * whole thing in one SQLite transaction, and so the chaos suite can kill it
 * part-way and prove the cursor did not move.
 */
export function applyPull(
  batch: PullBatch,
  store: LocalStore,
  options: {
    readonly transaction: <T>(work: () => T) => T
    readonly actorMayResolve?: boolean
  },
): PullResult {
  const conflicts: PullResult['conflicts'] = []
  let applied = 0
  let rejected = 0

  try {
    options.transaction(() => {
      for (const incoming of batch.records) {
        const current = store.get(incoming.entity, incoming.recordId)

        // Unknown record: nothing to conflict with.
        if (current === null) {
          store.put(incoming.entity, incoming.recordId, {
            version: incoming.version,
            fields: incoming.fields,
            deletedAt: incoming.deletedAt ?? null,
            updatedBy: incoming.updatedBy,
          })
          applied += 1
          continue
        }

        // A soft delete is versioned; an older one cannot undo a newer edit.
        if (incoming.deletedAt != null) {
          if (incoming.version < current.version) {
            rejected += 1
            continue
          }
          store.put(incoming.entity, incoming.recordId, {
            ...current,
            version: incoming.version,
            deletedAt: incoming.deletedAt,
            updatedBy: incoming.updatedBy,
          })
          applied += 1
          continue
        }

        // A pull carries the server's view. It conflicts only where this
        // device holds an unsent edit to the same field — otherwise it is
        // simply news, and applying it loses nothing.
        const pending = current.pendingLocalFields ?? {}
        const contested = Object.keys(incoming.fields).filter(
          (field) => field in pending && pending[field] !== incoming.fields[field],
        )

        const resolution = resolve({
          entity: incoming.entity,
          // Presenting the LOCAL pending edit as the incoming change, against
          // the server's record, is what makes the chooser show "mine" and
          // "theirs" the way round the user expects (§L7).
          current: {
            ...current,
            version: incoming.version,
            fields: { ...current.fields, ...incoming.fields },
          },
          incoming: {
            baseVersion: contested.length > 0 ? incoming.version - 1 : incoming.version,
            fields: contested.length > 0 ? pending : incoming.fields,
            actorId: incoming.updatedBy,
            deviceId: 'server',
          },
          ...(incoming.documentType === undefined ? {} : { documentType: incoming.documentType }),
          ...(incoming.documentStatus === undefined ? {} : { documentStatus: incoming.documentStatus }),
          ...(options.actorMayResolve === undefined
            ? {}
            : { actorMayResolve: options.actorMayResolve }),
        })

        switch (resolution.kind) {
          case 'applied':
          case 'merged':
            store.put(incoming.entity, incoming.recordId, {
              version: incoming.version,
              fields: resolution.fields,
              deletedAt: current.deletedAt ?? null,
              updatedBy: incoming.updatedBy,
            })
            applied += 1
            break
          case 'conflict':
            // Both versions are kept; the local record is untouched until the
            // user chooses (§L7). Nothing is lost in the meantime.
            conflicts.push({ entity: incoming.entity, recordId: incoming.recordId, resolution })
            break
          case 'rejected':
          case 'ignored':
            rejected += 1
            break
        }
      }
    })
  } catch (error) {
    // The transaction rolled back, so the cursor must not move. The batch is
    // simply fetched again.
    throw new PullError(
      `Pull batch failed and was rolled back; the cursor stays put. ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  return { applied, conflicts, rejected, cursor: batch.cursor }
}
