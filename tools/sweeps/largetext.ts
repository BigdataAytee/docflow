/**
 * The large-text sweep (§Q Phase 7, §V, §L9).
 *
 * §V: "**Large text**, screen readers, keyboard navigation and reduced motion
 * work **without clipped actions**."
 *
 * `src/a11y.test.tsx` already proves the LABELS reflow — §F's longest-label
 * test. This proves the LAYOUT does, which is a different failure and one
 * jsdom cannot see: at 200% text a row that fits at the default size pushes
 * its button off the edge, or a fixed-height container crops the thing you
 * are meant to tap.
 *
 * Two measurements, because "clipped" happens two ways:
 *
 *  · the page scrolls sideways, so the action is off-screen horizontally;
 *  · a box with `overflow: hidden` is shorter than its own content, so the
 *    action is inside it but cut off — which produces no scrollbar and no
 *    warning anywhere.
 *
 * Scaling is done by setting the root font size, which is what a phone's
 * "larger text" setting does to a page built in `rem`.
 */

import type { Page } from 'playwright'

/** 16px is the default; 32 is the 200% every accessibility guide asks for. */
export const LARGE_TEXT_PX = 32

export interface Clipped {
  readonly route: string
  readonly kind: 'scrolls sideways' | 'content cut off'
  readonly detail: string
}

export async function applyLargeText(page: Page, px = LARGE_TEXT_PX): Promise<void> {
  await page.addStyleTag({ content: `html { font-size: ${px}px !important; }` })
  // Let the reflow settle before measuring it.
  await page.waitForTimeout(300)
}

export async function clippedAt(page: Page, route: string): Promise<readonly Clipped[]> {
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
    const findings = []

    // Judged by ELEMENTS, never by scrollWidth against clientWidth.
    //
    // That comparison is a false-positive generator: clientWidth excludes the
    // scrollbar and scrollWidth does not, so a page with a vertical scrollbar
    // and no horizontal overflow whatsoever reports ~10px over. It cost an
    // hour here — four real findings were fixed and a fifth kept reappearing
    // on a page where nothing was actually wide.
    //
    // An element past the viewport edge is the thing a person can see and fix.
    {
      const wide = []
      for (const element of Array.from(document.body.querySelectorAll('*'))) {
        const box = element.getBoundingClientRect()
        if (box.right <= edge + 1 && box.left >= -1) continue
        // A horizontal SCROLLER is not page overflow. The statement's five
        // money columns do not fit 320px and scroll inside their own region;
        // the page itself does not move. Without this, every legitimate
        // scroller is reported forever and the sweep teaches people to ignore
        // it -- the same way the scrollWidth comparison would have.
        //
        // "auto" and "scroll" only, never "hidden": content inside an
        // overflow-hidden box does not scroll the page either, but it is not
        // reachable at all, and that is worth hearing about.
        let scroller = false
        for (let up = element.parentElement; up !== null; up = up.parentElement) {
          const overflow = getComputedStyle(up).overflowX
          if (overflow === 'auto' || overflow === 'scroll') { scroller = true; break }
        }
        if (scroller) continue
        const parent = element.parentElement
        // The OUTERMOST offender only: a wide row makes every child wide.
        if (parent !== null && parent !== document.body) {
          const parentBox = parent.getBoundingClientRect()
          if (parentBox.right > edge + 1 || parentBox.left < -1) continue
        }
        const tag = element.tagName.toLowerCase()
        const cls = (element.getAttribute('class') || '').slice(0, 70)
        wide.push(tag + '.' + cls)
      }
      if (wide.length > 0) {
        findings.push({
          kind: 'scrolls sideways',
          detail: wide.slice(0, 3).join(' | '),
        })
      }
    }

    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const style = getComputedStyle(element)
      const hidesOverflow = style.overflow === 'hidden' || style.overflowY === 'hidden'
      if (!hidesOverflow) continue
      // A few pixels of slack: rounded corners and shadows routinely put
      // scrollHeight a hair over clientHeight with nothing actually cut.
      if (element.scrollHeight <= element.clientHeight + 4) continue
      // Only where something interactive is inside it — a cropped decorative
      // band is not a clipped action.
      if (element.querySelector('button, a, input, select, textarea') === null) continue
      const tag = element.tagName.toLowerCase()
      const cls = (element.getAttribute('class') || '').slice(0, 60)
      findings.push({
        kind: 'content cut off',
        detail: tag + '.' + cls + ' (' + element.scrollHeight + ' in ' + element.clientHeight + ')',
      })
    }
    return findings.slice(0, 5)
  })()`)) as { kind: Clipped['kind']; detail: string }[]

  return measured.map((finding) => ({ route, ...finding }))
}

export function reportOf(findings: readonly Clipped[], routes: number): string {
  if (findings.length === 0) {
    return `  ${routes} routes, nothing clipped at ${LARGE_TEXT_PX}px root text`
  }
  const lines = [`  ${findings.length} findings at ${LARGE_TEXT_PX}px root text:`]
  for (const finding of findings) lines.push(`    ${finding.route}: ${finding.kind} — ${finding.detail}`)
  return lines.join('\n')
}
