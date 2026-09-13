/**
 * Taking §T's store screenshots, and refusing to save the wrong ones.
 *
 *     npm run shots
 *
 * §T names the failure this exists to prevent: "**Not a translated caption
 * over an EN-NG screenshot.**" That failure is invisible in a PNG — nobody
 * reviewing a folder of images notices that the Spanish set says "Invoice",
 * and the store will not either. So before each frame is written, the page is
 * asked whether it actually rendered the words the plan requires: the type's
 * local plural label, and the market's currency symbol. A frame that did not
 * is NOT saved; a missing file is a problem somebody finds, and a wrong file
 * is one nobody does.
 *
 * Two output roots, because those are two different things:
 *
 *  · `submittable/` — markets with nothing blocking them. **Empty today**, and
 *    the README inside says why.
 *  · `draft/` — everything, each market's folder carrying its own BLOCKERS.txt.
 *    Drafts exist so the machinery is exercised and reviewable rather than
 *    written, never run, and trusted — which is exactly how `npm run pentest`
 *    came to do nothing at all.
 */

import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'

import { chromium, type Browser, type Page } from 'playwright'

import { SHOT_REGIONS, planFor, reportOf, shotReport } from '../../src/marketing/shots/plan'
import type { ShotPlan } from '../../src/marketing/shots/spec'

const ROOT = process.cwd()
const BUILD = join(ROOT, 'dist-shots')
const OUT = join(ROOT, 'dist-shots-png')

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

/** A static server for the built screenshot app. Nothing fetches the network. */
function serve(dir: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const asset = join(dir, url.pathname)
    // Anything that is not a real file is the SPA entry: the app routes
    // client-side, so /list/invoice must serve shots.html.
    const file =
      url.pathname !== '/' && existsSync(asset) && statSync(asset).isFile()
        ? asset
        : join(dir, 'shots.html')
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })

  return new Promise((done) => {
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

export interface Frame {
  readonly file: string
  readonly saved: boolean
  readonly reason: string
}

/**
 * One frame. Returns what happened rather than throwing, so one missing label
 * does not abandon the other forty-one frames — and so the report names every
 * problem at once instead of the first.
 */
export async function capture(
  page: Page,
  origin: string,
  region: string,
  plan: ShotPlan,
  outRoot: string,
): Promise<Frame> {
  await page.setViewportSize({ width: plan.device.cssWidth, height: plan.device.cssHeight })
  await page.goto(`${origin}${plan.shot.route}?region=${region}`, { waitUntil: 'load' })
  // The app resolves its backend and its locale after mount; waiting for the
  // words themselves is both the readiness signal and the assertion.
  await page.waitForLoadState('networkidle')

  const text = await page.innerText('body')
  const missing = plan.mustContain.filter((needle) => !text.includes(needle))
  if (missing.length > 0) {
    return {
      file: plan.file,
      saved: false,
      reason: `the page never rendered ${missing.map((m) => `"${m}"`).join(', ')}`,
    }
  }

  const target = resolve(outRoot, plan.file)
  if (!target.startsWith(`${outRoot}/`)) {
    return { file: plan.file, saved: false, reason: 'the path escapes the output directory' }
  }
  mkdirSync(dirname(target), { recursive: true })
  await page.screenshot({ path: target })
  return { file: plan.file, saved: true, reason: 'saved' }
}

async function shootRegion(
  browser: Browser,
  origin: string,
  region: string,
  outRoot: string,
): Promise<readonly Frame[]> {
  const plan = planFor(region)
  const frames: Frame[] = []

  for (const device of new Set(plan.plans.map((entry) => entry.device))) {
    const context = await browser.newContext({
      viewport: { width: device.cssWidth, height: device.cssHeight },
      deviceScaleFactor: device.scale,
      // Store screenshots are of a phone. A desktop user-agent would render
      // the same components with hover affordances nobody on a phone sees.
      isMobile: device.store === 'play' || device.id.startsWith('iphone'),
      hasTouch: true,
    })
    const page = await context.newPage()
    for (const entry of plan.plans.filter((candidate) => candidate.device === device)) {
      frames.push(await capture(page, origin, region, entry, outRoot))
    }
    await context.close()
  }
  return frames
}

export async function main(): Promise<number> {
  if (!existsSync(join(BUILD, 'shots.html'))) {
    console.error(
      'dist-shots is missing. Build it first:\n' +
        '  npx vite build --config vite.shots.config.ts',
    )
    return 2
  }

  const report = shotReport()
  console.log(reportOf(report))

  const { origin, close } = await serve(BUILD)
  const browser = await chromium.launch()
  const problems: string[] = []

  try {
    for (const region of SHOT_REGIONS) {
      const plan = planFor(region)
      const root = join(OUT, plan.blockers.length === 0 ? 'submittable' : 'draft')
      const frames = await shootRegion(browser, origin, region, root)

      if (plan.blockers.length > 0) {
        mkdirSync(join(root, region), { recursive: true })
        writeFileSync(
          join(root, region, 'BLOCKERS.txt'),
          `${plan.blockers.join('\n')}\n`,
          'utf8',
        )
      }
      for (const frame of frames) {
        if (!frame.saved) problems.push(`${region}/${frame.file}: ${frame.reason}`)
      }
      console.log(
        `  ${region}: ${frames.filter((f) => f.saved).length}/${frames.length} frames written`,
      )
    }
  } finally {
    await browser.close()
    await close()
  }

  mkdirSync(join(OUT, 'submittable'), { recursive: true })
  writeFileSync(
    join(OUT, 'submittable', 'README.txt'),
    report.shootable.length === 0
      ? 'Empty, and that is correct.\n\n' +
          'No market can be shot for submission yet:\n\n' +
          report.regions.flatMap((entry) => entry.blockers.map((b) => `  - ${b}`)).join('\n') +
          '\n\nThe drafts alongside show what the frames will look like.\n'
      : `Submittable markets: ${report.shootable.join(', ')}\n`,
    'utf8',
  )

  if (problems.length > 0) {
    console.error(`\n${problems.length} frames were NOT written:`)
    for (const problem of problems) console.error(`  ${problem}`)
    return 1
  }
  console.log(`\nWritten to ${OUT}`)
  return 0
}
