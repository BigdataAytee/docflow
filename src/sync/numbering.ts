/**
 * Numbering reservations (§M).
 *
 * "Use server-reserved number blocks where available; the offline fallback is
 * a stable device-qualified final reference. The server enforces company/type/
 * reference uniqueness … A gapless central sequence would force online
 * issuance and is rejected."
 *
 * So a device holds a block it may spend offline, and falls back to a
 * device-qualified reference when the block runs out — never to waiting for
 * the network, which would break Rule #3.
 */

import type { DocumentType } from '../domain/documents/types'
import { buildReference } from '../features/documents/reference'

export class NumberingError extends Error {}

export interface Reservation {
  readonly companyId: string
  readonly docType: DocumentType
  readonly deviceId: string
  readonly rangeStart: number
  readonly rangeEnd: number
  /** The next unspent number in the block. */
  readonly next: number
}

export const remaining = (reservation: Reservation): number =>
  Math.max(0, reservation.rangeEnd - reservation.next + 1)

export const isExhausted = (reservation: Reservation): boolean => remaining(reservation) === 0

export interface IssuedNumber {
  readonly reference: string
  readonly sequence: number
  readonly fromReservedBlock: boolean
  readonly reservation: Reservation | null
}

/**
 * Take the next reference. Spends the block where one is held; otherwise mints
 * a device-qualified reference so issuing offline never blocks (§M, §R).
 */
export function takeNumber(input: {
  readonly reservation: Reservation | null
  readonly prefix: string
  readonly deviceId: string
  /** Used only when no block is held — the device's own local counter. */
  readonly localSequence: number
}): IssuedNumber {
  const { reservation, prefix, deviceId } = input

  if (reservation !== null && !isExhausted(reservation)) {
    const sequence = reservation.next
    return {
      reference: buildReference({ prefix, sequence, fromReservedBlock: true, deviceId }),
      sequence,
      fromReservedBlock: true,
      reservation: { ...reservation, next: sequence + 1 },
    }
  }

  // No block, or it ran out. Issue anyway — waiting for the server here would
  // make a core journey depend on the network, which Rule #3 forbids.
  const sequence = input.localSequence
  return {
    reference: buildReference({ prefix, sequence, fromReservedBlock: false, deviceId }),
    sequence,
    fromReservedBlock: false,
    reservation,
  }
}

/** Two devices must never be handed overlapping blocks. */
export function assertNoOverlap(reservations: readonly Reservation[]): void {
  const byScope = new Map<string, Reservation[]>()
  for (const reservation of reservations) {
    const key = `${reservation.companyId}:${reservation.docType}`
    byScope.set(key, [...(byScope.get(key) ?? []), reservation])
  }

  for (const [scope, group] of byScope) {
    const sorted = [...group].sort((a, b) => a.rangeStart - b.rangeStart)
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1]
      const current = sorted[i]
      if (previous === undefined || current === undefined) continue
      if (current.rangeStart <= previous.rangeEnd) {
        throw new NumberingError(
          `Overlapping number blocks for ${scope}: ${previous.rangeStart}-${previous.rangeEnd} and ${current.rangeStart}-${current.rangeEnd}. Two devices would mint the same reference.`,
        )
      }
    }
  }
}
