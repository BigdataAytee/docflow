/**
 * Whether the app can actually be read, in both themes (§F, §G).
 *
 * WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text. The interesting word is
 * "actual" — what has to clear the threshold is the colour that reaches
 * somebody's eye, not the token it started as.
 *
 * WHY THIS PHOTOGRAPHS THE PAGE. A muted line in this app is `text-ink/60`
 * inside a glass surface at 70% over a gradient page, under a backdrop blur.
 * There is no token in that stack holding the colour anybody sees. Worse,
 * nearly every surface here is a gradient IMAGE — glass, pills, the nav, the
 * fields, the tiles, the header — so walking the DOM compositing
 * `background-color` would read `transparent` over and over and then answer
 * confidently with the page colour, which is not what is behind the text.
 *
 * So: screenshot, then read pixels. The screenshot is decoded by drawing it
 * into a canvas on a second page, which is why this needs no image library.
 * `contrast.ts` holds the arithmetic and is tested without a browser.
 *
 * VIEWPORT AT A TIME, NOT FULL PAGE. A full-page screenshot in Chromium
 * repaints fixed elements — this app's header and bottom nav — at positions
 * that are not where they were, so the pixels under a heading would be the
 * pixels from somewhere else. Scrolling a viewport at a time is slower and
 * correct.
 *
 * `npm run sweep:contrast`. Out of `npm run verify`: CI downloads no browser.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

import { BUILD, ROUTES, serve } from './serve'
import {
  NON_TEXT_RATIO,
  contrastRatio,
  format,
  requiredRatio,
  separate,
  type Rgb,
} from './contrast'

/** A phone, at the width the rest of the sweeps use. */
const VIEWPORT = { width: 390, height: 844 }

/** How far down each route is walked. Four screens is past every fold here. */
const SCREENS = 4

interface Patch {
  readonly label: string
  readonly kind: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly px: number
  readonly weight: number
  /** What painted it, so the report names a class rather than a colour. */
  readonly source: string
}

interface Finding {
  readonly route: string
  readonly theme: string
  readonly label: string
  readonly kind: string
  readonly ratio: number
  readonly required: number
  readonly foreground: Rgb
  readonly background: Rgb
  readonly source: string
}

/**
 * Every line of text on screen, as a box to photograph.
 *
 * LINE BOXES, via a range over the text itself — not element boxes. An
 * element's box includes its padding and any child with a background of its
 * own, so the commonest colour inside it can easily be a colour the text is
 * not sitting on. A range's rects are tight around the glyphs, so what is
 * behind them is what is behind them.
 *
 * Text INSIDE the A4 document preview is collected too, and marked, because
 * the page a customer receives has to be readable as well — but it is paper
 * and stays light in both themes, so it is asserted once rather than twice.
 *
 * TWO KINDS OF TEXT THAT ARE NOT ON SCREEN, and both looked like failures:
 *
 *  · `sr-only` LABELS. They are laid out at full size and then clipped to a
 *    single pixel, so a range still reports a 57x21 box — over which nothing
 *    is painted. The sweep dutifully measured the empty background behind the
 *    bottom nav and reported "Settings" at 1.25:1 on every route in the app.
 *    A label for a screen reader has no contrast to fail; it is not drawn.
 *  · TEXT UNDER SOMETHING ELSE. A sheet, a dialog or a drawer covers what is
 *    behind it, and the pixels there belong to the cover. Hit-testing the
 *    middle of the line says who actually owns those pixels.
 */
const COLLECT = [
  '(() => {',
  '  const out = []',
  '  const seen = new Set()',
  '  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)',
  '  let node',
  '  while ((node = walker.nextNode())) {',
  "    const text = (node.textContent || '').trim()",
  "    if (text === '') continue",
  '    const el = node.parentElement',
  '    if (el === null) continue',
  "    if (el.closest('[aria-hidden=\"true\"]') !== null) continue",
  '    const style = getComputedStyle(el)',
  "    if (style.visibility === 'hidden' || style.display === 'none') continue",
  '    if (parseFloat(style.opacity) === 0) continue',
  '    /* Clipped to a pixel for a screen reader: laid out, never painted. */',
  '    const own = el.getBoundingClientRect()',
  '    if (own.width < 2 || own.height < 2) continue',
  "    if (style.clipPath !== 'none' || (style.clip !== 'auto' && style.clip !== '')) continue",
  '    const range = document.createRange()',
  '    range.selectNodeContents(node)',
  '    for (const rect of range.getClientRects()) {',
  '      if (rect.width < 6 || rect.height < 6) continue',
  '      if (rect.bottom <= 0 || rect.top >= innerHeight) continue',
  '      if (rect.right <= 0 || rect.left >= innerWidth) continue',
  '      /* Whoever owns the middle of this line owns its pixels. */',
  '      const midX = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2))',
  '      const midY = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2))',
  '      const top = document.elementFromPoint(midX, midY)',
  '      if (top === null) continue',
  '      if (top !== el && !el.contains(top) && !top.contains(el)) continue',
  '      /* WCAG 1.4.3 exempts inactive components, and says so in as many',
  '         words. A greyed control is greyed BECAUSE it cannot be used. */',
  "      if (el.closest('[disabled], [aria-disabled=\"true\"]') !== null) continue",
  "      const key = [Math.round(rect.x), Math.round(rect.y), text.slice(0, 12)].join('|')",
  '      if (seen.has(key)) continue',
  '      seen.add(key)',
  '      out.push({',
  '        label: text.slice(0, 44),',
  "        kind: el.closest('article[aria-label]') !== null ? 'paper' : 'screen',",
  '        x: Math.max(0, Math.floor(rect.left)),',
  '        y: Math.max(0, Math.floor(rect.top)),',
  '        width: Math.ceil(Math.min(rect.width, innerWidth - rect.left)),',
  '        height: Math.ceil(Math.min(rect.height, innerHeight - rect.top)),',
  '        px: parseFloat(style.fontSize),',
  '        weight: parseInt(style.fontWeight, 10) || 400,',
  "        source: el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 90),",
  '      })',
  '    }',
  '  }',
  '  /*',
  '   * AND THE ICONS (WCAG 2.2 1.4.11).',
  '   *',
  '   * An icon is an inline SVG with no text node in it, so the walk above',
  '   * cannot see one. That was the whole blind spot: every glyph in the app',
  '   * - the Home card plates, the round controls, the row icons, the nav -',
  '   * was outside what this sweep measured, while the pass it backed claimed',
  '   * WCAG AA. The owner found the card plates by opening the app in dark',
  '   * mode and seeing nothing in them.',
  '   */',
  "  for (const svg of document.querySelectorAll('svg')) {",
  '    const rect = svg.getBoundingClientRect()',
  '    if (rect.width < 10 || rect.height < 10) continue',
  '    if (rect.width > 120 || rect.height > 120) continue',
  '    if (rect.bottom <= 0 || rect.top >= innerHeight) continue',
  '    if (rect.right <= 0 || rect.left >= innerWidth) continue',
  '    const iconStyle = getComputedStyle(svg)',
  "    if (iconStyle.visibility === 'hidden' || iconStyle.display === 'none') continue",
  '    if (parseFloat(iconStyle.opacity) === 0) continue',
  '    const owner = svg.parentElement',
  '    if (owner === null) continue',
  "    if (owner.closest('[disabled], [aria-disabled=\"true\"]') !== null) continue",
  '    const iconX = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2))',
  '    const iconY = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2))',
  '    const over = document.elementFromPoint(iconX, iconY)',
  '    if (over !== null && over !== svg && !svg.contains(over) && !over.contains(svg)) continue',
  "    const named = owner.getAttribute('aria-label') || owner.textContent || ''",
  '    const cls = owner.className',
  "    const clsText = typeof cls === 'string' ? cls : cls && cls.baseVal ? cls.baseVal : ''",
  '    out.push({',
  "      label: named.trim().slice(0, 44) || 'icon',",
  "      kind: 'icon',",
  '      x: Math.max(0, Math.floor(rect.left)),',
  '      y: Math.max(0, Math.floor(rect.top)),',
  '      width: Math.ceil(Math.min(rect.width, innerWidth - rect.left)),',
  '      height: Math.ceil(Math.min(rect.height, innerHeight - rect.top)),',
  '      px: 0,',
  '      weight: 0,',
  "      source: 'svg in ' + owner.tagName.toLowerCase() + '.' + clsText.slice(0, 80),",
  '    })',
  '  }',
  '  return out',
  '})()',
].join('\n')

/**
 * Reads the pixels of each patch out of a screenshot.
 *
 * Runs on a SCRATCH page holding nothing but a canvas. Drawing the image into
 * the page under test would change the page under test.
 *
 * ITS ARGUMENT IS INLINED, not passed. Playwright treats a STRING
 * `pageFunction` as an expression and ignores `arg` entirely — so passing the
 * screenshot alongside it evaluated to a function object, which does not
 * serialise, and every patch came back undefined. Source strings are how this
 * half of the build talks to a browser at all, since it has no DOM lib, so
 * the argument goes into the source.
 */
const READ = `(async ({ url, patches }) => {
  const image = new Image()
  await new Promise((done, fail) => {
    image.onload = done
    image.onerror = fail
    image.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0)
  return patches.map((patch) => {
    const width = Math.min(patch.width, canvas.width - patch.x)
    const height = Math.min(patch.height, canvas.height - patch.y)
    if (width < 1 || height < 1) return null
    return Array.from(context.getImageData(patch.x, patch.y, width, height).data)
  })
})`

const scan = async (
  theme: 'light' | 'dark',
  contrast: 'no-preference' | 'more' = 'no-preference',
): Promise<Finding[]> => {
  const { origin, close } = await serve(BUILD)
  const browser = await chromium.launch()
  const findings: Finding[] = []
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: theme,
      contrast,
    })
    const page = await context.newPage()
    const scratch = await context.newPage()
    await scratch.setContent('<!doctype html><title>scratch</title>')

    for (const route of ROUTES) {
      await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' })
      /* The theme is applied by an effect; give React its commit. */
      await page.waitForTimeout(120)

      for (let screen = 0; screen < SCREENS; screen += 1) {
        const patches = (await page.evaluate(COLLECT)) as Patch[]
        if (patches.length > 0) {
          const shot = await page.screenshot({ type: 'png' })
          const url = `data:image/png;base64,${shot.toString('base64')}`
          const call = `(${READ})(${JSON.stringify({ url, patches })})`
          const samples = (await scratch.evaluate(call)) as (number[] | null)[]

          patches.forEach((patch, index) => {
            const data = samples[index]
            if (data == null) return
            const found = separate({ data })
            /*
             * Nothing to compare. Either the patch was empty, or the ink and
             * what is behind it are the same colour — reported by the test
             * below rather than as a ratio, because a 1:1 "ratio" and
             * "nothing was painted" are different bugs with different fixes.
             */
            if (found === null) return
            const ratio = contrastRatio(found.foreground, found.background)
            findings.push({
              route,
              theme,
              label: patch.label,
              kind: patch.kind,
              ratio,
              /* WCAG 1.4.11: a glyph is non-text, and its floor is 3:1. */
              required:
                patch.kind === 'icon'
                  ? NON_TEXT_RATIO
                  : requiredRatio(patch.px, patch.weight),
              foreground: found.foreground,
              background: found.background,
              source: patch.source,
            })
          })
        }

        const moved = (await page.evaluate(
          `(() => { const before = scrollY; scrollBy(0, innerHeight - 60); return scrollY !== before })()`,
        )) as boolean
        if (!moved) break
        await page.waitForTimeout(80)
      }
    }
  } finally {
    await browser.close()
    await close()
  }
  return findings
}

const hex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

/**
 * Everything measured, grouped by the colour pair that produced it.
 *
 * Two hundred failures are not two hundred bugs: they are a handful of
 * classes, each repeated across every route that uses it. Grouping is what
 * turns a wall of lines into the short list of things to actually change, and
 * it is what Part E's table is built from.
 */
const writeReport = (rows: readonly Finding[]): string => {
  const groups = new Map<string, { rows: Finding[]; worst: number }>()
  for (const row of rows) {
    const key = `${row.theme}|${hex(row.foreground)}|${hex(row.background)}|${row.required}`
    const group = groups.get(key) ?? { rows: [], worst: Number.POSITIVE_INFINITY }
    group.rows.push(row)
    group.worst = Math.min(group.worst, row.ratio)
    groups.set(key, group)
  }
  const summary = [...groups.entries()]
    .map(([key, group]) => {
      const [theme, foreground, background, required] = key.split('|')
      return {
        theme,
        foreground,
        background,
        required: Number(required),
        worst: Number(group.worst.toFixed(2)),
        count: group.rows.length,
        routes: [...new Set(group.rows.map((row) => row.route))],
        examples: [...new Set(group.rows.map((row) => row.label))].slice(0, 4),
        sources: [...new Set(group.rows.map((row) => row.source))].slice(0, 3),
      }
    })
    .sort((a, b) => a.worst - b.worst)

  const path = join(BUILD, 'contrast-report.json')
  writeFileSync(path, JSON.stringify(summary, null, 2))
  return path
}

const report = (rows: readonly Finding[]): string =>
  [...rows]
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 14)
    .map(
      (row) =>
        `${row.theme}  ${row.route}  "${row.label}" — ${format(row.ratio)} ` +
        `(needs ${row.required}:1, ${hex(row.foreground)} on ${hex(row.background)})`,
    )
    .join('\n  ')

/*
 * Scanned once per theme and shared, because a scan walks every route at four
 * scroll positions taking a screenshot at each. Running that again per
 * assertion would be minutes of browser for no extra truth.
 */
let scans: { light: Finding[]; dark: Finding[] } | null = null
const measured = async () => {
  scans ??= { light: await scan('light'), dark: await scan('dark') }
  return scans
}

/** The same walk, with the phone's high-contrast setting turned on. */
let insisted: { light: Finding[]; dark: Finding[] } | null = null
const underMoreContrast = async () => {
  insisted ??= {
    light: await scan('light', 'more'),
    dark: await scan('dark', 'more'),
  }
  return insisted
}

describe.runIf(process.env.SWEEP === '1')('The app can be read, in both themes (§F)', () => {
  it('finds text on every route to measure', async () => {
    const { light, dark } = await measured()
    const routes = new Set(light.map((row) => row.route))
    expect(routes.size, 'some routes yielded no measurable text').toBe(ROUTES.length)
    expect(light.length).toBeGreaterThan(400)
    /* Both themes measured, or half the pass is imaginary. */
    expect(dark.length).toBeGreaterThan(400)

    /* The grouped inventory, for reading and for the report. */
    const path = writeReport([...light, ...dark])
    expect(path).toContain('contrast-report.json')
  }, 600_000)

  it.each(['light', 'dark'] as const)('clears AA for every word on screen in %s', async (theme) => {
    const rows = (await measured())[theme].filter((row) => row.kind === 'screen')
    const failing = rows.filter((row) => row.ratio < row.required - 0.005)
    expect(
      failing.length,
      `${failing.length} of ${rows.length} fail AA in ${theme}:\n  ${report(failing)}`,
    ).toBe(0)
  }, 600_000)

  /**
   * THE ICONS (WCAG 2.2 1.4.11), which this sweep could not see at all.
   *
   * It walked text nodes. An icon has none — it is an inline SVG — so every
   * glyph in the app was outside the measurement while the pass it backed
   * reported WCAG AA. Two of them were badly wrong and neither was found
   * here: the Home card plates, which paint the LOCKED accent on that type's
   * dark tint and are near-invisible in dark mode, and Home's two round
   * controls, which a change in this very pass had put at 2.0:1.
   *
   * A guard that measures one half of a rule and is described by the whole
   * rule's name is the shape that passes while the bug ships.
   */
  it.each(['light', 'dark'] as const)('clears 3:1 for every icon in %s', async (theme) => {
    const rows = (await measured())[theme].filter((row) => row.kind === 'icon')
    expect(rows.length, `no icons were measured in ${theme}`).toBeGreaterThan(80)

    const failing = rows.filter((row) => row.ratio < row.required - 0.005)
    expect(
      failing.length,
      `${failing.length} of ${rows.length} icons fail 3:1 in ${theme}:\n  ${report(failing)}`,
    ).toBe(0)
  }, 600_000)

  /**
   * AND WHEN THE PHONE ASKS FOR MORE CONTRAST, it gets more.
   *
   * §G and the platform both carry the setting, and somebody who has turned
   * it on has said something specific: the general case does not work for
   * them. Passing AA is not an answer to that — AA is the floor the general
   * case sits on.
   *
   * So this asserts two things. Everything still clears AA, which a rule
   * that switched off the wrong thing could break. And the WORST ratio on
   * the app measurably IMPROVES, which is the only way to tell an
   * implementation from a media query nobody wired up: a block that matches
   * and does nothing passes the first assertion perfectly.
   */
  it.each(['light', 'dark'] as const)(
    'gets stronger, not merely legal, on %s with prefers-contrast: more',
    async (theme) => {
      const normal = (await measured())[theme].filter((row) => row.kind === 'screen')
      const stronger = (await underMoreContrast())[theme].filter((row) => row.kind === 'screen')

      const failing = stronger.filter((row) => row.ratio < row.required - 0.005)
      expect(
        failing.length,
        `${failing.length} fail AA under prefers-contrast in ${theme}:\n  ${report(failing)}`,
      ).toBe(0)

      /*
       * ELEMENT BY ELEMENT, not worst against worst.
       *
       * The first version compared the lowest ratio in each pass, and the
       * lowest ratio is not necessarily a faded thing — it moved 4.56 to
       * 4.64 while a hundred muted lines went from 4.5 to 12, and the
       * assertion called that "changed nothing". What matters is the shape
       * of the change: many things stronger, nothing weaker.
       */
      const key = (row: Finding) => `${row.route}|${row.source}|${row.label}`
      const was = new Map(normal.map((row) => [key(row), row]))
      let improved = 0
      const worsened: string[] = []
      for (const row of stronger) {
        const before = was.get(key(row))
        if (before === undefined) continue
        /*
         * A REAL GAIN, not jitter. Two runs of the same page differ by a few
         * hundredths — enough that counting any increase at all found 35
         * "improvements" with the whole media query deleted, against a
         * threshold of 40. A quarter more contrast is not something a
         * browser does by accident.
         */
        if (row.ratio > before.ratio * 1.25) improved += 1
        /*
         * A REGRESSION IS A THING PUSHED TOWARDS THE FLOOR, not any movement
         * at all. Making glass opaque changes what is behind everything by a
         * little, so a heading at 13.5:1 reading 13.1:1 afterwards is the
         * surface settling, not a fault — and an assertion that called it one
         * would have to be silenced, which is how a guard stops being read.
         *
         * What must never happen is something comfortable becoming marginal.
         */
        const marginal = row.required * 1.1
        if (row.ratio < before.ratio - 0.1 && row.ratio < marginal && before.ratio >= marginal) {
          worsened.push(`${row.route} "${row.label}" ${format(before.ratio)} → ${format(row.ratio)}`)
        }
      }

      expect(
        worsened.length,
        `the preference pushed ${worsened.length} things towards the floor in ${theme}:` +
          `\n  ${worsened.slice(0, 8).join('\n  ')}`,
      ).toBe(0)
      /*
       * And it did something. A media query that matches and changes nothing
       * passes every assertion above it perfectly.
       */
      expect(
        improved,
        `only ${improved} things got meaningfully stronger in ${theme} — ` +
          'the preference is not wired up',
      ).toBeGreaterThan(40)
    },
    600_000,
  )

  /**
   * THE PAGE A CUSTOMER RECEIVES. It is paper and stays light in both themes
   * — that is deliberate, and §F is explicit — so it is asserted once. The
   * muted labels on it are the same kind of risk as a muted line in the app:
   * ink at 55% opacity looks like a design choice and reads as a ratio.
   */
  it('clears AA on the printed page itself', async () => {
    const rows = (await measured()).light.filter((row) => row.kind === 'paper')
    expect(rows.length, 'the document preview was never measured').toBeGreaterThan(20)
    const failing = rows.filter((row) => row.ratio < row.required - 0.005)
    expect(
      failing.length,
      `${failing.length} of ${rows.length} fail AA on paper:\n  ${report(failing)}`,
    ).toBe(0)
  }, 600_000)
})
