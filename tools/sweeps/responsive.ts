/**
 * The responsive sweep (§Q Phase 7, §V).
 *
 * §V asks that actions are never clipped. The failure this catches is the one
 * nobody sees on a laptop: a row that is a few pixels too wide on the
 * narrowest phone still in use, so the page scrolls sideways and the primary
 * action sits off the edge of the screen.
 *
 * jsdom cannot find it — it computes no layout, so every element is zero by
 * zero and every check passes. It needs a real engine, which the screenshot
 * work already put in the repo, pointed at the same built app.
 *
 * 320 CSS pixels is the floor: an iPhone SE in its smallest text size, and
 * still the width a great many Android phones report.
 */

import type { Page } from 'playwright'

export const NARROWEST = 320

export interface Overflow {
  readonly route: string
  readonly scrollWidth: number
  readonly clientWidth: number
  /** The widest offending elements, for somebody to go and fix. */
  readonly culprits: readonly string[]
}

/**
 * Does this page scroll sideways, and if so what is doing it?
 *
 * Judged by ELEMENTS past the viewport edge, never by `scrollWidth` against
 * `clientWidth`. **That comparison is unsound**, which the large-text sweep
 * found the hard way: `clientWidth` excludes the scrollbar and `scrollWidth`
 * does not, so a page with a vertical scrollbar and no horizontal overflow at
 * all reports about ten pixels over. This check shipped with it in #39 and
 * passed — it produced no false failure, but it would have.
 *
 * The tolerance is one pixel either side: sub-pixel rounding in a flex row
 * routinely puts a box a fraction over, and failing on that would train
 * everybody to ignore the check.
 */
export async function overflowAt(page: Page, route: string): Promise<Overflow | null> {
  /**
   * Passed as SOURCE rather than as a function, because this project has no
   * DOM lib — it is the node half of the build. The browser compiles it; the
   * shape it returns is asserted on the way back in.
   */
  const measured = (await page.evaluate(`(() => {
    const root = document.documentElement
    // The viewport edge a FIXED element is measured against.
    //
    // clientWidth excludes the scrollbar; the initial containing block does
    // not. So a full-width fixed inset-x-0 bar -- the bottom nav -- sizes
    // correctly to the ICB and still reads as overflowing clientWidth by the
    // scrollbar width, on every page, forever. Proved by hiding the nav: the
    // page measured identically without it.
    const edge = Math.max(root.clientWidth, window.innerWidth)
    const wide = []
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const box = element.getBoundingClientRect()
      if (box.right > edge + 1 || box.left < -1) {
        const parent = element.parentElement
        if (parent !== null && parent !== document.body) {
          const parentBox = parent.getBoundingClientRect()
          if (parentBox.right > edge + 1 || parentBox.left < -1) continue
        }
        const tag = element.tagName.toLowerCase()
        const cls = (element.getAttribute('class') || '').slice(0, 60)
        wide.push(tag + '.' + cls + ' (' + Math.round(box.left) + '…' + Math.round(box.right) + ')')
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: edge,
      culprits: wide.slice(0, 5),
    }
  })()`)) as { scrollWidth: number; clientWidth: number; culprits: string[] }

  return measured.culprits.length > 0 ? { route, ...measured } : null
}

export function reportOf(findings: readonly Overflow[], routes: number): string {
  if (findings.length === 0) return `  ${routes} routes, none scrolls sideways at ${NARROWEST}px`
  const lines = [`  ${findings.length} of ${routes} routes scroll sideways at ${NARROWEST}px:`]
  for (const finding of findings) {
    lines.push(`    ${finding.route}: ${finding.culprits.length} element(s) past the edge`)
    for (const culprit of finding.culprits) lines.push(`      ${culprit}`)
  }
  return lines.join('\n')
}
