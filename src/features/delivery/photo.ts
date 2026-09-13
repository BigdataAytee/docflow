/**
 * The photo on a delivery (§G, §E, §P).
 *
 * §G's fourth delivery action, and §E's "delivery photo asset". It is the
 * thing that settles an argument three weeks later: the stack at the gate,
 * the plate number, the state the goods arrived in.
 *
 * The rules:
 *
 *  · **It is evidence, so it seals.** §E lists it beside `signer_name` and
 *    `signed_at`, and §P says delivery evidence cannot be altered once
 *    captured. A photo added AFTER the customer signed would change what the
 *    record says happened, on a document the customer already has a copy of.
 *    So it can be attached right up to the moment of signing, and not after.
 *  · **It is not a signature and cannot stand in for one.** A photo of a
 *    stack of bags proves goods arrived somewhere; it does not say who took
 *    them. `signDelivery` still requires a name and a mark, and this module
 *    deliberately cannot satisfy either.
 *  · **One photo.** §E says "delivery photo asset", singular, and Rule #1
 *    agrees — a gallery is a different feature with a different cost.
 *    Attaching another replaces the reference; the old asset is untouched,
 *    because assets are append-only (§P).
 */

import type { DocumentType } from '../../domain/documents/types'
import { isEvidenceSealed } from '../../domain/documents/lifecycle'

/** A token, not a sentence. The words are the catalogue's (§S, Rule #4). */
export class DeliveryPhotoError extends Error {
  constructor(
    readonly field: PhotoBlocker,
    message: string,
  ) {
    super(message)
    this.name = 'DeliveryPhotoError'
  }
}

export type PhotoBlocker = 'not_a_delivery' | 'not_issued' | 'sealed' | 'void'

export interface PhotographableDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly deliveryPhotoAssetId?: string
}

/**
 * Why a photo cannot be attached, or null.
 *
 * A draft is excluded because there is nothing to be evidence OF yet, and a
 * withdrawn delivery because it did not happen.
 */
export function reasonsPhotoIsBlocked(document: PhotographableDocument): PhotoBlocker | null {
  if (document.type !== 'waybill') return 'not_a_delivery'
  if (document.status === 'void') return 'void'
  if (document.status === 'draft') return 'not_issued'
  // The one that matters: once signed for, the record of what happened is
  // closed (§P). Same seal as the signature, reached from a different door.
  if (isEvidenceSealed(document.type, document.status)) return 'sealed'
  return null
}

export const canAttachPhoto = (document: PhotographableDocument): boolean =>
  reasonsPhotoIsBlocked(document) === null

export interface AttachedPhoto {
  readonly documentId: string
  readonly assetId: string
  /** The one it replaces, if any. Kept for the record; the asset survives. */
  readonly replaces?: string
  /** §P: a photo is evidence, never a substitute for the customer's mark. */
  readonly isNotASignature: true
}

export function attachDeliveryPhoto(
  document: PhotographableDocument,
  assetId: string,
): AttachedPhoto {
  const blocked = reasonsPhotoIsBlocked(document)
  if (blocked !== null) {
    throw new DeliveryPhotoError(blocked, `Document ${document.id} cannot take a photo now.`)
  }
  if (assetId === '') {
    throw new DeliveryPhotoError('not_issued', 'A photo needs to have been stored first.')
  }

  return Object.freeze({
    documentId: document.id,
    assetId,
    ...(document.deliveryPhotoAssetId === undefined
      ? {}
      : { replaces: document.deliveryPhotoAssetId }),
    isNotASignature: true,
  })
}
