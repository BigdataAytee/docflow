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
 * The tolerance is one pixel: sub-pixel rounding in a flex row routinely
 * produces a scrollWidth a fraction over, and failing on that would train
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
    const wide = []
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const box = element.getBoundingClientRect()
      if (box.right > root.clientWidth + 1 || box.left < -1) {
        const tag = element.tagName.toLowerCase()
        const cls = (element.getAttribute('class') || '').slice(0, 60)
        wide.push(tag + '.' + cls + ' (' + Math.round(box.left) + '…' + Math.round(box.right) + ')')
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      culprits: wide.slice(0, 5),
    }
  })()`)) as { scrollWidth: number; clientWidth: number; culprits: string[] }

  return measured.scrollWidth > measured.clientWidth + 1
    ? { route, ...measured }
    : null
}

export function reportOf(findings: readonly Overflow[], routes: number): string {
  if (findings.length === 0) return `  ${routes} routes, none scrolls sideways at ${NARROWEST}px`
  const lines = [`  ${findings.length} of ${routes} routes scroll sideways at ${NARROWEST}px:`]
  for (const finding of findings) {
    lines.push(`    ${finding.route}: ${finding.scrollWidth} > ${finding.clientWidth}`)
    for (const culprit of finding.culprits) lines.push(`      ${culprit}`)
  }
  return lines.join('\n')
}
