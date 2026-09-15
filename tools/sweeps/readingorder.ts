/**
 * Does the app read in the order it looks? (§V, D12.)
 *
 * A screen reader announces in DOM order. A sighted person reads in VISUAL
 * order. Every CSS property that separates the two — `order`, `row-reverse`,
 * grid placement, absolute positioning — creates a page where what is heard
 * and what is seen are different documents, and nothing in an accessibility
 * tree reveals it: every name is right, every role is right, and the
 * sentences arrive in the wrong sequence.
 *
 * This is the part of "reading order" a machine can honestly check, and it
 * was on D12's list of things needing a human until it turned out not to be.
 * What still needs a person is whether the order that results makes SENSE —
 * a machine can see that the total is announced before the line items; only
 * a listener can tell you that hearing it that way is confusing.
 *
 * **Siblings only, deliberately.** Comparing two elements in different parts
 * of the page means comparing two formatting contexts, where a multi-column
 * layout legitimately puts a later element higher up. Children of one parent
 * share a context, and that is exactly where the reversing properties live.
 */

export interface Box {
  /** Document order among its siblings, 0-based. */
  readonly index: number
  readonly top: number
  readonly bottom: number
  /** The reading edge: `left` in a left-to-right page, `right` in an RTL one. */
  readonly start: number
  /** For the report, so somebody can find it. */
  readonly label: string
}

export interface Inversion {
  readonly route: string
  readonly parent: string
  /** Document order, as names. */
  readonly heard: readonly string[]
  /** Visual order, as names. */
  readonly seen: readonly string[]
}

/**
 * Rows before columns, and a row is decided by OVERLAP rather than by `top`.
 *
 * The first version compared tops with a tolerance, and reported four
 * settings screens and both builders as broken. They were not: a row with
 * `items-center` holding a 20px label beside a 44px button puts the label's
 * top twelve pixels lower, and comparing tops read that as "the button comes
 * first". Two boxes whose vertical spans overlap are on the same line, however
 * their tops line up, and that is what a person sees.
 *
 * The tolerance stays, as a floor: boxes that graze each other by a pixel or
 * two are stacked, not aligned.
 */
export const SAME_ROW = 8

const sameLine = (a: Box, b: Box): boolean =>
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > SAME_ROW

export function visualOrder(boxes: readonly Box[]): Box[] {
  return [...boxes].sort((a, b) => {
    if (!sameLine(a, b)) return a.top - b.top
    return a.start - b.start
  })
}

/** Does what this parent's children SAY match the order they are SEEN in? */
export function inversionOf(
  route: string,
  parent: string,
  boxes: readonly Box[],
): Inversion | null {
  if (boxes.length < 2) return null

  const heard = [...boxes].sort((a, b) => a.index - b.index)
  const seen = visualOrder(boxes)
  if (heard.every((box, at) => box.index === seen[at]?.index)) return null

  return {
    route,
    parent,
    heard: heard.map((box) => box.label),
    seen: seen.map((box) => box.label),
  }
}

/**
 * The page-side scan.
 *
 * Passed as SOURCE rather than as a function, like the other browser sweeps:
 * this project has no DOM lib, so the browser compiles it and the shape it
 * returns is asserted on the way back in.
 *
 * Only elements that ANNOUNCE something are compared. A wrapper div with no
 * name and no text is not a stop a reader makes, and including them would
 * report layout scaffolding as a reading-order fault.
 */
export const READING_ORDER_SCAN = `(() => {
  const rtl = getComputedStyle(document.documentElement).direction === 'rtl'
  const groups = []

  const announces = (element) => {
    const tag = element.tagName.toLowerCase()
    if (['script', 'style', 'template', 'br'].includes(tag)) return false
    if (element.closest('[aria-hidden="true"]') !== null) return false
    const box = element.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) return false
    /*
     * A VISUALLY HIDDEN element has no place in a visual order.
     *
     * A screen-reader-only class clips its element to a 1px box pinned
     * wherever the layout happens to leave it, so comparing where it is SEEN
     * against where it is HEARD compares a real position with a meaningless
     * one. The builder's status band — a live region, correctly placed last
     * in the DOM because position is irrelevant to one — read as an inversion
     * on four routes for exactly that reason.
     *
     * This is not an exemption for hidden CONTENT: an element with zero size
     * is already out above, and anything a reader can hear and a person can
     * SEE still has both orders compared. It only declines to rank something
     * that has no visual rank to have.
     */
    if (box.width <= 1 || box.height <= 1) return false
    if (element.getAttribute('aria-label')) return true
    if (['a', 'button', 'input', 'select', 'textarea', 'h1', 'h2', 'h3', 'h4'].includes(tag)) return true
    // Its own text, not a descendant's: a wrapper is not a stop.
    return Array.from(element.childNodes).some(
      (node) => node.nodeType === 3 && (node.textContent || '').trim() !== '',
    )
  }

  const label = (element) => {
    const name = element.getAttribute('aria-label') || (element.textContent || '').trim()
    return (element.tagName.toLowerCase() + ' ' + name).slice(0, 60)
  }

  for (const parent of Array.from(document.body.querySelectorAll('*'))) {
    const kids = Array.from(parent.children).filter(announces)
    if (kids.length < 2) continue

    groups.push({
      parent: label(parent),
      boxes: kids.map((element, index) => {
        const box = element.getBoundingClientRect()
        return {
          index,
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          start: Math.round(rtl ? -box.right : box.left),
          label: label(element),
        }
      }),
    })
  }

  return groups
})()`

export function reportOf(inversions: readonly Inversion[], routes: number): string {
  if (inversions.length === 0) {
    return `  ${routes} routes, each reads in the order it looks`
  }
  const lines = [`  ${inversions.length} place(s) where the page reads out of order:`]
  for (const found of inversions.slice(0, 10)) {
    lines.push(`    ${found.route} — inside ${found.parent}`)
    lines.push(`      heard: ${found.heard.join(' → ')}`)
    lines.push(`      seen:  ${found.seen.join(' → ')}`)
  }
  return lines.join('\n')
}
