/**
 * The logo holder (§G).
 *
 * "White rounded square with a thin inner margin; the logo scales to touch the
 * margin — square nearly fills, wide spans width, tall runs height — NEVER
 * cropped."
 *
 * Expressed as arithmetic rather than a CSS property so the rule holds in the
 * on-screen preview and in the native PDF writer alike, and so "never cropped"
 * is something a test can prove for any aspect ratio (§V: "Logos never crop").
 */

export interface Size {
  readonly width: number
  readonly height: number
}

export interface LogoFit extends Size {
  /** Offsets that centre the logo inside the holder's inner box. */
  readonly left: number
  readonly top: number
}

export class LogoError extends Error {}

/** §G's three sizes, as a fraction of the holder the design allots. */
export const LOGO_SCALE: Readonly<Record<'S' | 'M' | 'L', number>> = {
  S: 0.7,
  M: 0.85,
  L: 1,
}

/**
 * Fit `natural` inside `holder`, honouring the inner margin and preserving the
 * aspect ratio. The result never exceeds the inner box on either axis, which
 * is what "never cropped" means arithmetically.
 */
export function fitLogo(natural: Size, holder: Size, margin: number): LogoFit {
  if (natural.width <= 0 || natural.height <= 0) {
    throw new LogoError('A logo needs real dimensions before it can be placed.')
  }
  if (margin < 0) throw new LogoError('The inner margin cannot be negative.')

  const innerWidth = holder.width - margin * 2
  const innerHeight = holder.height - margin * 2
  if (innerWidth <= 0 || innerHeight <= 0) {
    throw new LogoError('The inner margin leaves no room for the logo.')
  }

  // Contain, never cover: the smaller ratio wins, so the whole mark fits.
  const scale = Math.min(innerWidth / natural.width, innerHeight / natural.height)
  const width = natural.width * scale
  const height = natural.height * scale

  return {
    width,
    height,
    left: margin + (innerWidth - width) / 2,
    top: margin + (innerHeight - height) / 2,
  }
}

/** True when the placement keeps the whole mark inside the holder. */
export function isFullyVisible(fit: LogoFit, holder: Size, margin: number): boolean {
  const epsilon = 1e-9
  return (
    fit.left >= margin - epsilon &&
    fit.top >= margin - epsilon &&
    fit.left + fit.width <= holder.width - margin + epsilon &&
    fit.top + fit.height <= holder.height - margin + epsilon
  )
}
