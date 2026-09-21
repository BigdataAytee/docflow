/**
 * The static server every Playwright sweep points a browser at.
 *
 * EXTRACTED FROM `responsive.test.ts`, where it used to live. A second sweep
 * importing it from there imported the whole FILE — so `responsive`'s own
 * suite ran again as part of the new one, under the new one's name. It found
 * a real failure that way, which is the only reason it was noticed rather
 * than quietly doubling every sweep's runtime.
 *
 * Shared helpers belong beside the sweeps, not inside one of them.
 */

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

/** The screenshot build: the same components, with records in them. */
export const BUILD = join(process.cwd(), 'dist-shots')

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
  // The record screens, by the fixture ids `shots/fixtures.ts` mints. Until
  // the screen-reader sweep went looking, no sweep covered the document page
  // at all — the screen the app exists for.
  '/doc/invoice_1',
  '/doc/waybill_1',
  '/customers/cu_1',
  '/customers/cu_1/statement/NGN',
]
