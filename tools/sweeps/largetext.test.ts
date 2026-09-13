/**
 * Running the large-text sweep against the real app (§V).
 *
 * `npm run sweep:largetext`. Same build and same routes as the responsive
 * sweep — the two ask different questions of the same pages, and asking them
 * of different pages would be how a finding hides.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

import { LARGE_TEXT_PX, type Clipped, applyLargeText, clippedAt, reportOf } from './largetext'
import { BUILD, ROUTES, serve } from './responsive.test'

describe.runIf(process.env.SWEEP === '1')(`Nothing is clipped at ${LARGE_TEXT_PX}px text (§V)`, () => {
  it('checks every route with records in it', async () => {
    expect(existsSync(join(BUILD, 'shots.html')), 'build it first: npm run shots:build').toBe(true)

    const { origin, close } = await serve(BUILD)
    const browser = await chromium.launch()
    const findings: Clipped[] = []

    try {
      // A normal phone width, so this measures TEXT SIZE rather than a narrow
      // screen — the responsive sweep already owns 320px.
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
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
        await applyLargeText(page)
        findings.push(...(await clippedAt(page, route)))
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
