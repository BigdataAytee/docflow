/**
 * Conflict resolution (§M, §L7).
 *
 * "Record revisions, not device timestamps. Non-overlapping edits to editable
 * drafts merge automatically; same-field edits retain both versions behind the
 * plain-language chooser. Issued financial documents, payment events, delivery
 * evidence and permission changes are never silently overwritten. Only
 * entitled users resolve. Soft deletion is versioned; a stale update cannot
 * resurrect a record."
 *
 * Revisions rather than clocks because two phones disagree about the time and
 * neither is wrong — §Q's chaos suite includes clock skew for exactly that
 * reason. A revision is a fact about the record; a timestamp is an opinion
 * about the device.
 */

import type { DocumentType } from '../domain/documents/types'
import { isImmutable } from '../domain/documents/lifecycle'
import type { Entity } from './operations'

export class ConflictError extends Error {}

export interface RecordVersion {
  readonly version: number
  readonly fields: Readonly<Record<string, unknown>>
  readonly deletedAt?: string | null
  readonly updatedBy: string
  /**
   * Fields edited on THIS device and not yet acknowledged by the server.
   *
   * Without this a pull cannot tell a plain update from a genuine two-device
   * conflict: a server change to a field nobody touched locally is simply the
   * news, while a server change to a field with an unsent local edit is the
   * case §M says must retain both versions.
   */
  readonly pendingLocalFields?: Readonly<Record<string, unknown>>
}

export interface IncomingChange {
  readonly baseVersion: number
  readonly fields: Readonly<Record<string, unknown>>
  readonly actorId: string
  readonly deviceId: string
  readonly deletes?: boolean
}

export type Resolution =
  /** Applied cleanly — the change was made against the current version. */
  | { readonly kind: 'applied'; readonly fields: Readonly<Record<string, unknown>> }
  /** Concurrent but disjoint: both edits survive, no question asked (§M). */
  | { readonly kind: 'merged'; readonly fields: Readonly<Record<string, unknown>> }
  /** Same field, both versions kept, user chooses (§L7). */
  | {
      readonly kind: 'conflict'
      readonly fields: readonly string[]
      readonly mine: Readonly<Record<string, unknown>>
      readonly theirs: Readonly<Record<string, unknown>>
    }
  /** Refused outright — evidence is never silently overwritten (§M). */
  | { readonly kind: 'rejected'; readonly reason: string }
  /** A stale update that would have resurrected a deleted record (§M). */
  | { readonly kind: 'ignored'; readonly reason: string }

/**
 * Entities whose records are evidence, not drafts. A late edit to one of these
 * is refused rather than merged or offered as a choice: §M lists payment
 * events and delivery evidence alongside issued documents, and none of them is
 * something a second device may quietly rewrite.
 */
const EVIDENCE_ENTITIES: ReadonlySet<Entity> = new Set([
  'payment',
  'payment_allocation',
  'credit_note',
])

/** Fields frozen at issue. Never overwritten, by anyone, ever (§M, §D.2). */
const FROZEN_FIELDS: ReadonlySet<string> = new Set([
  'issuedReference',
  'issued_reference',
  'frozenLabels',
  'frozen_labels',
  'totalMinor',
  'total_minor',
  'issuedAt',
  'issued_at',
])

export interface ResolveInput {
  readonly entity: Entity
  readonly current: RecordVersion
  readonly incoming: IncomingChange
  /** For a document: its type and stored status, to judge immutability. */
  readonly documentType?: DocumentType
  readonly documentStatus?: string
  /** §M: "Only entitled users resolve." */
  readonly actorMayResolve?: boolean
}

export function resolve(input: ResolveInput): Resolution {
  const { current, incoming } = input

  // A stale update cannot resurrect a deleted record (§M). Checked first,
  // because nothing else matters if the record is gone.
  if (current.deletedAt != null && incoming.baseVersion < current.version) {
    return {
      kind: 'ignored',
      reason: 'This record was deleted after the change was made, so the change is not applied.',
    }
  }

  const touched = Object.keys(incoming.fields)

  // Frozen fields are refused regardless of versions or entitlement.
  const frozen = touched.filter((field) => FROZEN_FIELDS.has(field))
  if (frozen.length > 0) {
    return {
      kind: 'rejected',
      reason: `A document's reference, labels and totals are fixed when it is issued and cannot be changed by a sync (v6 §M): ${frozen.join(', ')}.`,
    }
  }

  // Evidence is never silently overwritten.
  if (EVIDENCE_ENTITIES.has(input.entity)) {
    return {
      kind: 'rejected',
      reason:
        'Money that was recorded is not edited. Correct it with a reversal and a replacement (v6 §E).',
    }
  }

  if (
    input.documentType !== undefined &&
    input.documentStatus !== undefined &&
    isImmutable(input.documentType, input.documentStatus)
  ) {
    return {
      kind: 'rejected',
      reason:
        'This document has been issued. Corrections are a void and reissue, or a credit note (v6 §C).',
    }
  }

  // Made against the current version: nothing concurrent happened.
  if (incoming.baseVersion === current.version) {
    return { kind: 'applied', fields: { ...current.fields, ...incoming.fields } }
  }

  if (incoming.baseVersion > current.version) {
    throw new ConflictError(
      `Change claims version ${incoming.baseVersion} but the record is at ${current.version}.`,
    )
  }

  // Concurrent. Which fields did the other edit actually touch?
  const theirFields = Object.keys(current.fields)
  const overlapping = touched.filter(
    (field) => theirFields.includes(field) && current.fields[field] !== incoming.fields[field],
  )

  if (overlapping.length === 0) {
    // Disjoint edits to a draft merge without asking (§M).
    return { kind: 'merged', fields: { ...current.fields, ...incoming.fields } }
  }

  if (input.actorMayResolve === false) {
    return {
      kind: 'rejected',
      reason: 'Someone else needs to choose which version to keep.',
    }
  }

  // Both versions are kept. Nothing is discarded before the user decides (§L7).
  return {
    kind: 'conflict',
    fields: overlapping,
    mine: Object.fromEntries(overlapping.map((f) => [f, incoming.fields[f]])),
    theirs: Object.fromEntries(overlapping.map((f) => [f, current.fields[f]])),
  }
}

export type ConflictChoice = 'mine' | 'theirs'

/** Applying the user's choice. Both versions were kept until this moment. */
export function applyChoice(
  resolution: Extract<Resolution, { kind: 'conflict' }>,
  current: RecordVersion,
  choice: ConflictChoice,
): Record<string, unknown> {
  const chosen = choice === 'mine' ? resolution.mine : resolution.theirs
  return { ...current.fields, ...chosen }
}
