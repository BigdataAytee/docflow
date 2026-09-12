/**
 * Signing for a delivery (§G, §P, §E).
 *
 * §Q's Phase 2 gate walks "create and sign a delivery document" in airplane
 * mode, and Rule #1 caps it at "one tap plus at most one small sheet". So the
 * whole act is: who took it, optionally their role, their mark — and the
 * document is delivered.
 *
 * The rules that shape it:
 *
 *  · **Evidence is captured once.** `delivered` is terminal in the lifecycle
 *    and `isEvidenceSealed` covers it. A second signature would overwrite the
 *    first, and the customer holding the earlier PDF would have no way to
 *    know. So a signed delivery refuses, here AND in the repository.
 *  · **Signed and delivered are one fact.** §P: "atomic delivered +
 *    timestamp". This module produces one patch; the repository applies it in
 *    one write. There is no arrangement of these fields that says delivered
 *    without saying by whom.
 *  · **A name without a mark is not a signature, and a mark without a name is
 *    not evidence.** Both are required; the role is not, because a delivery
 *    taken by "Bisi" with no title recorded is still a delivery taken.
 */

import { type DocumentType } from '../../domain/documents/types'
import { canTransition, isEvidenceSealed } from '../../domain/documents/lifecycle'

/** A token, not a sentence. The words are the catalogue's (§S, Rule #4). */
export class DeliverySignError extends Error {
  constructor(
    readonly field: 'not_a_delivery' | 'sealed' | 'not_out_yet' | 'name' | 'signature',
    message: string,
  ) {
    super(message)
    this.name = 'DeliverySignError'
  }
}

/** What this module needs of a document. */
export interface SignableDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
}

export type SigningBlocker = 'not_a_delivery' | 'sealed' | 'not_out_yet'

/**
 * Why this document cannot be signed for, or null.
 *
 * Ordered so the FIRST reason is the most useful one to say: "already signed"
 * beats "cannot reach delivered", even though a delivered document is both.
 */
export function reasonsSigningIsBlocked(document: SignableDocument): SigningBlocker | null {
  if (document.type !== 'waybill') return 'not_a_delivery'
  if (isEvidenceSealed(document.type, document.status)) return 'sealed'
  if (!canTransition(document.type, document.status, 'delivered')) return 'not_out_yet'
  return null
}

export const canSign = (document: SignableDocument): boolean =>
  reasonsSigningIsBlocked(document) === null

/**
 * The step that has to happen before this delivery can be signed for, or null.
 *
 * The lifecycle does not let an issued delivery jump straight to delivered —
 * something that never left cannot have arrived — so a freshly issued one
 * needs sending on its way first. Without this the sign action would be
 * unreachable: correct by the table, and invisible in the app.
 *
 * Derived from the transition table rather than hardcoded, so a change to the
 * lifecycle changes the button instead of silently disagreeing with it.
 */
export function nextDeliveryStep(document: SignableDocument): 'dispatched' | null {
  if (document.type !== 'waybill') return null
  if (canTransition(document.type, document.status, 'delivered')) return null
  return canTransition(document.type, document.status, 'dispatched') ? 'dispatched' : null
}

export interface SignDeliveryInput {
  readonly document: SignableDocument
  readonly signerName: string
  readonly signerRole?: string
  /** The mark itself, already stored. A document never holds the bytes (§E). */
  readonly signatureAssetId: string
  readonly at: string
}

export interface SignedDelivery {
  readonly documentId: string
  readonly signerName: string
  readonly signerRole?: string
  readonly signedAt: string
  readonly signatureAssetId: string
  /** Always `delivered`. Signing IS delivery; there is no other outcome. */
  readonly status: 'delivered'
  /** §P: the evidence and the status are one write, never two. */
  readonly isAtomic: true
}

export function signDelivery(input: SignDeliveryInput): SignedDelivery {
  const blocked = reasonsSigningIsBlocked(input.document)
  if (blocked !== null) {
    throw new DeliverySignError(blocked, `Document ${input.document.id} cannot be signed for now.`)
  }

  const signerName = input.signerName.trim()
  if (signerName === '') {
    throw new DeliverySignError('name', 'A mark with nobody behind it is not evidence (v6 §P).')
  }
  if (input.signatureAssetId === '') {
    throw new DeliverySignError('signature', 'A name with no mark is not a signature (v6 §P).')
  }

  const role = input.signerRole?.trim() ?? ''
  return Object.freeze({
    documentId: input.document.id,
    signerName,
    ...(role === '' ? {} : { signerRole: role }),
    signedAt: input.at,
    signatureAssetId: input.signatureAssetId,
    status: 'delivered' as const,
    isAtomic: true as const,
  })
}
