/**
 * Running the responsive sweep against the real app at 320px.
 *
 * Reuses the screenshot build: the same components, the same routes, with
 * records in them — an empty app has nothing wide enough to overflow, so an
 * empty-state sweep would pass and prove nothing.
 *
 * `npm run sweep:responsive` runs it. It is not in `npm test`, because it
 * needs a browser and CI does not download one.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

import { NARROWEST, type Overflow, overflowAt, reportOf } from './responsive'
import { BUILD, ROUTES, serve } from './serve'

/* Re-exported so the older sweeps keep importing from where they always have. */
export { BUILD, ROUTES, serve }


describe.runIf(process.env.SWEEP === '1')('Nothing scrolls sideways at 320px (§V)', () => {
  it('checks every route with records in it', async () => {
    expect(
      existsSync(join(BUILD, 'shots.html')),
      'build it first: npm run shots:build',
    ).toBe(true)

    const { origin, close } = await serve(BUILD)
    const browser = await chromium.launch()
    const findings: Overflow[] = []

    try {
      const context = await browser.newContext({
        viewport: { width: NARROWEST, height: 640 },
        deviceScaleFactor: 2,
        // NOT `isMobile`. A mobile layout viewport expands to fit content
        // wider than the screen and then re-lays everything out at the
        // expanded width — so the element that caused the overflow fits by
        // the time it is measured, and only innocent full-width boxes look
        // guilty. The screenshot capture keeps mobile emulation, where it
        // is right; measurement does not.
        isMobile: false,
        hasTouch: true,
      })
      const page = await context.newPage()
      for (const route of ROUTES) {
        await page.goto(`${origin}${route}?region=NG`, { waitUntil: 'networkidle' })
        const overflow = await overflowAt(page, route)
        if (overflow !== null) findings.push(overflow)
      }
      await context.close()
    } finally {
      await browser.close()
      await close()
    }

    console.log(reportOf(findings, ROUTES.length))
    expect(findings, reportOf(findings, ROUTES.length)).toEqual([])
  }, 600_000)
})
