/**
 * Contrast, as WCAG 2.2 defines it (§F, §G).
 *
 * The arithmetic half of the contrast sweep, kept separate from the browser
 * half so it can be tested with `npm test` rather than only when somebody has
 * a browser. Every number here is from WCAG 2.2's own definitions.
 *
 * WHY PIXELS AND NOT TOKENS. The obvious way to check contrast is to read
 * `--ink` and `--surface` and divide. That answers a question nobody asked.
 * What reaches somebody's eye is the composite: a muted class is
 * `text-ink/60` over a glass surface at 70% over a gradient page, and no
 * token in that stack is the colour anybody sees. This app puts a gradient
 * behind nearly every surface — glass, pills, nav, fields, tiles, the header
 * — so walking the DOM and compositing `background-color` up the tree would
 * be wrong for most of the screen, because the colour is in an IMAGE.
 *
 * So the sweep photographs the page and reads the pixels, and this module is
 * what turns those pixels into a ratio.
 */

export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

/** WCAG 2.2: relative luminance of an sRGB colour. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number): number => {
    const c = value / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.2: the contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * WCAG 2.2 "large text": 18pt, or 14pt when bold.
 *
 * In CSS reference pixels at the usual 96dpi that is 24px, and 18.66px bold.
 * Large text is held to 3:1 rather than 4.5:1 because size buys legibility
 * that contrast would otherwise have to.
 */
export const isLargeText = (px: number, weight: number): boolean =>
  px >= 24 || (px >= 18.66 && weight >= 700)

/** The AA threshold for text of this size and weight. */
export const requiredRatio = (px: number, weight: number): number =>
  isLargeText(px, weight) ? 3 : 4.5

/**
 * AA for anything that is not text: icons, borders, the edge of a control.
 *
 * WCAG 2.2 1.4.11. Quoted here so a caller never has to remember it.
 */
export const NON_TEXT_RATIO = 3

export interface Sample {
  /** Pixels as RGBA, four numbers each, in the order a canvas gives them. */
  readonly data: ArrayLike<number>
}

/**
 * The foreground and background actually present in a patch of pixels.
 *
 * THE PROBLEM THIS SOLVES. A photograph of a line of text is mostly
 * background with some glyphs in it, and between them a fringe of
 * anti-aliased pixels that are neither. Taking the darkest pixel as the text
 * and the lightest as the background would answer with the extremes of the
 * fringe; averaging would answer with a colour that is on the screen nowhere.
 *
 * So the pixels are QUANTISED into coarse buckets and counted. A glyph's core
 * is one frequent bucket. A background — even a gently graded one — is one or
 * two. The fringe is spread thinly over many, so no individual fringe bucket
 * is frequent enough to be mistaken for either.
 *
 *  · BACKGROUND is the most frequent bucket. Text never covers most of its
 *    own line box.
 *  · FOREGROUND is the frequent bucket furthest from it in luminance — the
 *    glyph core, and if two inks share a line, the harder one to read.
 *
 * Returns null when there is no second population at all, which means there
 * was nothing drawn: an empty box, or text the same colour as what is behind
 * it. The caller reports that as its own kind of finding rather than as a
 * ratio, because a ratio of 1 and "nothing was painted" are different bugs.
 */
export function separate(
  sample: Sample,
  /**
   * A bucket must hold at least this share of the patch to count.
   *
   * Low on purpose. Half a percent is generous to SPARSE text — a short word
   * on a wide line, or a thin weight — and it costs nothing in accuracy,
   * because the foreground is chosen as the bucket FURTHEST from the
   * background: an anti-aliased fringe pixel lies between the two by
   * definition, so it can never be picked while the glyph core is there.
   */
  minimumShare = 0.005,
): { foreground: Rgb; background: Rgb; coverage: number } | null {
  const { data } = sample
  const totals = new Map<number, { r: number; g: number; b: number; n: number }>()
  let counted = 0

  for (let index = 0; index + 3 < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0
    /* A transparent pixel is the page showing through, not a colour. */
    if (alpha < 250) continue
    const r = data[index] ?? 0
    const g = data[index + 1] ?? 0
    const b = data[index + 2] ?? 0
    /*
     * Five bits dropped per channel: eight levels each, 512 buckets. Coarse
     * enough that a gradient stays in one or two, fine enough that grey text
     * and a white card never land in the same one.
     */
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
    const cell = totals.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
    cell.r += r
    cell.g += g
    cell.b += b
    cell.n += 1
    totals.set(key, cell)
    counted += 1
  }

  if (counted === 0) return null

  const buckets = [...totals.values()]
    .map((cell) => ({
      colour: {
        r: Math.round(cell.r / cell.n),
        g: Math.round(cell.g / cell.n),
        b: Math.round(cell.b / cell.n),
      },
      share: cell.n / counted,
    }))
    .sort((a, b) => b.share - a.share)

  const background = buckets[0]
  if (background === undefined) return null

  const backgroundLuminance = luminance(background.colour)
  let foreground: (typeof buckets)[number] | undefined
  let furthest = 0
  for (const bucket of buckets.slice(1)) {
    if (bucket.share < minimumShare) continue
    const distance = Math.abs(luminance(bucket.colour) - backgroundLuminance)
    if (distance > furthest) {
      furthest = distance
      foreground = bucket
    }
  }

  if (foreground === undefined) return null
  return {
    foreground: foreground.colour,
    background: background.colour,
    coverage: foreground.share,
  }
}

/** A ratio as it is usually written: one decimal, then ":1". */
export const format = (ratio: number): string => `${ratio.toFixed(2)}:1`
