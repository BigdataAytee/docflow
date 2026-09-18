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
  return shrinkAs(file, maxEdge, 'image/jpeg', QUALITY)
}

/**
 * The one encoder. Every size and format this app stores goes through it.
 *
 * Three copies of "decode, measure, draw, encode" had already been written,
 * differing only in a number — which is three places for the EXIF-dropping
 * re-encode and the orientation fix to drift apart.
 */
async function shrinkAs(
  file: Blob,
  maxEdge: number,
  mime: 'image/jpeg' | 'image/png',
  quality?: number,
): Promise<string> {
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

  return quality === undefined ? canvas.toDataURL(mime) : canvas.toDataURL(mime, quality)
}

/* ------------------------------------------------------- line-item photos */

/**
 * A picture of the goods, sized for the table it prints in (§I, §M, Rule #1).
 *
 * MUCH SMALLER THAN A DELIVERY PHOTO, and deliberately so. A delivery photo
 * is evidence — the stack of bags, the plate number — and wants detail. A
 * line-item thumbnail is drawn about 40pt wide in the description column and
 * needs to be RECOGNISABLE, not readable: at 320px it is already four times
 * the resolution the page can print.
 *
 * The reason is the trader, not the byte count. These go out over WhatsApp on
 * metered data with poor signal, and a document with eight photographs in it
 * at delivery-photo size is several megabytes — which is not a slow PDF, it
 * is a PDF that never gets sent. A tenth of that, and the picture still does
 * its job on the page.
 *
 * ONE ASSET, not an original and a thumbnail. Keeping the full-resolution
 * photograph as well would double what syncs for the people who can least
 * afford it, to serve a zoom nothing in the app offers. If a "see it bigger"
 * ever arrives, 320px is still larger than a phone draws it in a list.
 */
export const ITEM_PHOTO_MAX_EDGE = 320
/** Lower than a delivery photo's: a thumbnail hides its own artefacts. */
export const ITEM_PHOTO_QUALITY = 0.6

/**
 * The ceiling a stored thumbnail must come in under, in data-URL characters.
 *
 * Roughly 60 KB of base64, which is about 45 KB of JPEG — comfortably above
 * what 320px at quality 0.6 produces for a photograph, and far below what a
 * document full of them could cost. It exists so the budget is a number
 * something can fail against rather than an intention in a comment.
 */
export const ITEM_PHOTO_BUDGET = 60_000

export async function shrinkItemPhoto(file: Blob): Promise<string> {
  return shrinkAs(file, ITEM_PHOTO_MAX_EDGE, 'image/jpeg', ITEM_PHOTO_QUALITY)
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
  return shrinkAs(file, LOGO_MAX_EDGE, 'image/png')
}
