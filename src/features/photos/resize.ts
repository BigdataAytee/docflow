/**
 * Making a phone photograph small enough to sync (§M, §G).
 *
 * §G puts "add photo" on a delivery and a receipt photo on an expense, and §M
 * puts both inside what airplane mode has to support: "airplane-mode restart
 * preserves documents, photos, signatures, payments", and "pending local
 * photos remain visible before upload".
 *
 * A photo straight off a modern phone is 3–8 MB. Storing that is the easy
 * thing and the wrong one: every photo eventually uploads, on whatever
 * connection the owner actually has, and §M's asset uploads "resume and
 * verify hashes" because that connection is assumed to be bad. A delivery
 * photo has to be LEGIBLE — the stack of bags, the gate, the plate number —
 * not archival. 1600px on the long edge at JPEG 0.8 reads perfectly at A4 and
 * lands around a tenth of the size.
 *
 * The arithmetic lives here, apart from the canvas, so the rule that decides
 * what a photo becomes is testable without a browser. `encode` is the thin
 * part that needs one.
 */

export interface Size {
  readonly width: number
  readonly height: number
}

/** Long edge, in pixels. A delivery photo is read, not enlarged. */
export const MAX_EDGE = 1600
/** JPEG quality. Above this the file grows faster than the detail does. */
export const QUALITY = 0.8

/**
 * The size this photo should be stored at.
 *
 * Never ENLARGES: a small photo blown up to 1600px is a bigger file carrying
 * no more information. Aspect ratio is kept exactly, and a rounded dimension
 * never reaches zero — a 4000×1 panorama is a strange photo, not a crash.
 */
export function targetSize(source: Size, maxEdge: number = MAX_EDGE): Size {
  const longest = Math.max(source.width, source.height)
  if (longest <= 0) return { width: 0, height: 0 }
  if (longest <= maxEdge) return { width: source.width, height: source.height }

  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

export class PhotoError extends Error {
  constructor(readonly field: 'not_an_image' | 'unreadable' | 'no_canvas') {
    super(`A photo could not be read (${field}).`)
    this.name = 'PhotoError'
  }
}

/** Everything this module accepts. A delivery photo is a photograph. */
export const ACCEPTED = 'image/*'

export const isImage = (type: string): boolean => type.startsWith('image/')

/**
 * A chosen file as a stored-ready data URL.
 *
 * Re-encoded rather than passed through, which also drops EXIF — a delivery
 * photo carries the goods, not the owner's GPS track. Orientation is applied
 * by `createImageBitmap` before that happens, so a portrait photo does not
 * arrive sideways with its rotation tag stripped.
 */
export async function shrinkImage(file: Blob, maxEdge: number = MAX_EDGE): Promise<string> {
  if (!isImage(file.type)) throw new PhotoError('not_an_image')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError('unreadable')
  }

  const size = targetSize({ width: bitmap.width, height: bitmap.height }, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (context === null) {
    bitmap.close()
    throw new PhotoError('no_canvas')
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', QUALITY)
}

/* ------------------------------------------------------------------ logos */

/**
 * A chosen logo as a stored-ready data URL (§F, §G).
 *
 * Two differences from a photograph, both of which matter on a document:
 *
 *  · **PNG, not JPEG.** A logo is usually transparent, and JPEG has no alpha
 *    — a mark re-encoded as JPEG arrives with a hard white rectangle behind
 *    it, which is invisible on the printed page's white holder and obvious on
 *    Home's blue header. Transparency is part of the artwork.
 *  · **512px, not 1600.** The largest a logo is ever drawn is the printed
 *    holder at `LOGO_SCALE.L`, well under 200px. A delivery photo is evidence
 *    and wants detail; a logo is a mark and wants to be small, because it is
 *    carried by every document and every sync.
 */
export const LOGO_MAX_EDGE = 512

export async function shrinkLogo(file: Blob): Promise<string> {
  if (!isImage(file.type)) throw new PhotoError('not_an_image')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError('unreadable')
  }

  const size = targetSize({ width: bitmap.width, height: bitmap.height }, LOGO_MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (context === null) {
    bitmap.close()
    throw new PhotoError('no_canvas')
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()

  return canvas.toDataURL('image/png')
}
