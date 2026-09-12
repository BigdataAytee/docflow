/**
 * A drawn signature (§G step 1, §I, §M).
 *
 * The signature is stored as **vector strokes rendered to SVG**, not as a
 * raster image, and that is the decision everything else here follows from:
 *
 *  · **It prints.** §I puts the captured signature on an A4 page above a 76px
 *    rule. A canvas PNG captured at phone density is soft at print size; a
 *    path is exact at any size.
 *  · **It is small.** A few hundred bytes against tens of kilobytes. Every
 *    signature syncs, and §M's uploads happen on the connection the owner
 *    actually has.
 *  · **It needs no canvas.** Pointer coordinates in, a string out — so it
 *    works in a WebView, under jsdom and in Node alike, and there is no
 *    native dependency standing between a signature and Phase 2's gate.
 *
 * No text of any kind enters the output: it is built from numbers this module
 * produced, so a signature can carry nothing but ink.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

/** One continuous mark — pointer down, move, up. */
export type Stroke = readonly Point[]
export type Strokes = readonly Stroke[]

export interface Bounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Stroke width in the same units as the captured points. */
export const STROKE_WIDTH = 2.4

/**
 * Total ink length. A signature is a journey, not a location — which is how
 * a stray tap is told from a mark somebody meant to make.
 */
export function inkLength(strokes: Strokes): number {
  let total = 0
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      const from = stroke[i - 1]
      const to = stroke[i]
      if (from === undefined || to === undefined) continue
      total += Math.hypot(to.x - from.x, to.y - from.y)
    }
  }
  return total
}

/**
 * Below this, nothing was signed.
 *
 * A tap, a slipped finger while scrolling, or a single dot is not a
 * signature, and accepting one would put an empty mark on a document that
 * then claims to be signed. The threshold is deliberately low — a short
 * initial is still a signature — it only rules out marks with no journey.
 */
export const MINIMUM_INK = 24

export const isBlank = (strokes: Strokes): boolean => inkLength(strokes) < MINIMUM_INK

/** Drop the last mark. Undo removes a stroke, never part of one. */
export const undoStroke = (strokes: Strokes): Strokes => strokes.slice(0, -1)

export function boundsOf(strokes: Strokes): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const stroke of strokes) {
    for (const point of stroke) {
      if (point.x < minX) minX = point.x
      if (point.y < minY) minY = point.y
      if (point.x > maxX) maxX = point.x
      if (point.y > maxY) maxY = point.y
    }
  }

  if (minX === Infinity) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const round = (value: number): number => Math.round(value * 10) / 10

/**
 * One stroke as an SVG path.
 *
 * Quadratic curves through the midpoints of consecutive samples, which is what
 * turns a polyline of pointer events into something that reads as handwriting.
 * A stroke of one point becomes a dot — the pen was put down, so there is ink.
 */
export function pathOf(stroke: Stroke): string {
  const first = stroke[0]
  if (first === undefined) return ''
  if (stroke.length === 1) {
    // A dot: a zero-length line with a round cap paints one.
    return `M${round(first.x)} ${round(first.y)}l0 0`
  }

  let path = `M${round(first.x)} ${round(first.y)}`
  for (let i = 1; i < stroke.length - 1; i += 1) {
    const point = stroke[i]
    const next = stroke[i + 1]
    if (point === undefined || next === undefined) continue
    path += `Q${round(point.x)} ${round(point.y)} ${round((point.x + next.x) / 2)} ${round(
      (point.y + next.y) / 2,
    )}`
  }
  const last = stroke[stroke.length - 1]
  if (last !== undefined) path += `L${round(last.x)} ${round(last.y)}`
  return path
}

export interface RenderedSignature {
  readonly svg: string
  readonly dataUrl: string
  readonly width: number
  readonly height: number
}

/**
 * The strokes as a standalone SVG, cropped to the ink.
 *
 * Cropping matters on the page: an uncropped capture is mostly the empty box
 * the owner drew inside, and §I gives the signature a slot beside the payment
 * box, not a full-width band. The padding is half a stroke width, so a mark
 * that runs to the edge keeps its round cap instead of being shaved.
 */
export function renderSignature(strokes: Strokes): RenderedSignature | null {
  const bounds = boundsOf(strokes)
  if (bounds === null || isBlank(strokes)) return null

  const pad = STROKE_WIDTH
  const width = round(bounds.width + pad * 2)
  const height = round(bounds.height + pad * 2)
  const shifted = strokes.map((stroke) =>
    stroke.map((point) => ({ x: point.x - bounds.x + pad, y: point.y - bounds.y + pad })),
  )
  const path = shifted.map(pathOf).filter((d) => d !== '').join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<path d="${path}" fill="none" stroke="currentColor" stroke-width="${STROKE_WIDTH}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`

  return { svg, dataUrl: toDataUrl(svg), width, height }
}

/**
 * `currentColor` does not resolve inside an `<img>`, so the stored copy is
 * given the ink colour outright. Ink is near-black rather than pure black:
 * §F's palette, and it is what a pen looks like against paper.
 */
export const INK = '#1A1F2B'

export function toDataUrl(svg: string): string {
  // encodeURIComponent rather than base64: it survives every transport a data
  // URL takes, stays readable in a diff, and is shorter for markup this small.
  return `data:image/svg+xml,${encodeURIComponent(svg.replace('currentColor', INK))}`
}
