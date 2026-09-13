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

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

import { NARROWEST, type Overflow, overflowAt, reportOf } from './responsive'

export const BUILD = join(process.cwd(), 'dist-shots')

/** Every route a person can reach, by its internal path (§G). */
export const ROUTES = [
  '/',
  '/list/invoice',
  '/list/quotation',
  '/list/receipt',
  '/list/waybill',
  '/customers',
  '/analytics',
  '/settings',
  '/settings/region',
  '/settings/company',
  '/settings/tax',
  '/settings/payment',
  '/settings/items',
  '/settings/signature',
  '/settings/data',
  '/new/invoice',
  '/new/waybill',
]

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

export function serve(dir: string) {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const asset = join(dir, path)
    const file =
      path !== '/' && existsSync(asset) && statSync(asset).isFile()
        ? asset
        : join(dir, 'shots.html')
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })
  return new Promise<{ origin: string; close: () => Promise<void> }>((done) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      done({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((closed) => server.close(() => closed())),
      })
    })
  })
}

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
