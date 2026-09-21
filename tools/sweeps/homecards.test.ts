/**
 * The four Home cards, measured on a real phone-width viewport (§F, §G).
 *
 * These are the front door: Invoices, Quotations, Receipts, Waybills, and
 * they were too small to hit confidently with a thumb. Making them bigger is
 * easy; making them bigger WITHOUT breaking at 360px or at 200% text is the
 * part that needs measuring, because the failure mode is a label clipped or a
 * card pushed off screen — neither of which a unit test can see.
 *
 * MEASURED, NOT ASSERTED FROM CLASSES. A test reading `min-h-[104px]` proves
 * the class is there and nothing about what the browser did with it. These
 * read `getBoundingClientRect` and `scrollWidth` off the rendered page, which
 * is the only thing that can tell a card that fits from one that does not.
 *
 * `npm run sweep:homecards` runs it. Like the other Playwright sweeps it is
 * not in `npm test`, because CI does not download a browser.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

import { BUILD, serve } from './serve'

/** §F's floor for anything a thumb has to hit. */
const MIN_TAP = 44

/** The narrowest phone this is built for. */
const PHONE = 360

interface CardBox {
  readonly label: string
  readonly width: number
  readonly height: number
  readonly labelClipped: boolean
  readonly chipFontPx: number
  readonly plateSize: number
}

const measure = async (width: number, textScale: number): Promise<CardBox[]> => {
  const { origin, close } = await serve(BUILD)
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({
      viewport: { width, height: 780 },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()
    /*
     * 200% TEXT the way a phone does it — the root font size, which is what
     * every `rem` and every Tailwind size is relative to. Zooming the page
     * instead would scale the viewport too and prove nothing about reflow.
     */
    /*
     * Passed as SOURCE, like every other sweep here: this is the node half of
     * the build and has no DOM lib. The browser compiles it; the shape it
     * returns is asserted on the way back in.
     */
    await page.addInitScript(
      `document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = '${16 * textScale}px'
      })`,
    )
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-type-card]')

    /*
     * CLIPPED is `scrollHeight > clientHeight`: the browser saying the text
     * needs more room than it was given, which is the only authority on a
     * wrapped label.
     */
    return (await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('[data-type-card]')]
      return cards.map((card) => {
        const box = card.getBoundingClientRect()
        const label = card.querySelector('[data-type-label]')
        const chip = card.querySelector('[data-type-count]')
        const plate = card.querySelector('[data-type-plate]')
        return {
          label: label ? label.textContent : '',
          width: box.width,
          height: box.height,
          labelClipped: !!label && label.scrollHeight > label.clientHeight + 1,
          chipFontPx: chip ? parseFloat(getComputedStyle(chip).fontSize) : 0,
          plateSize: plate ? plate.getBoundingClientRect().width : 0,
        }
      })
    })()`)) as CardBox[]
  } finally {
    await browser.close()
    await close()
  }
}

describe.runIf(process.env.SWEEP === '1')('The four Home cards fit and can be hit (§F, §G)', () => {
  it('gives every card a thumb-sized target at 360px', async () => {
    expect(existsSync(join(BUILD, 'shots.html')), 'build it first: npm run shots:build').toBe(true)

    const cards = await measure(PHONE, 1)
    expect(cards, 'the four type cards were not found').toHaveLength(4)

    for (const card of cards) {
      expect(card.height, `${card.label} is only ${card.height}px tall`).toBeGreaterThanOrEqual(
        MIN_TAP * 2,
      )
      expect(card.width, `${card.label} is only ${card.width}px wide`).toBeGreaterThanOrEqual(
        MIN_TAP * 2,
      )
      expect(card.labelClipped, `${card.label} is clipped`).toBe(false)
      // The count has to be readable at a glance, not squinted at.
      expect(card.chipFontPx, `${card.label}'s count is ${card.chipFontPx}px`).toBeGreaterThanOrEqual(11)
      expect(card.plateSize, `${card.label}'s icon plate is ${card.plateSize}px`).toBeGreaterThanOrEqual(42)
    }
  })

  /**
   * AND AT 200% TEXT, where the label wraps. §G's a11y floor: it may wrap to
   * as many lines as it needs, and it may never be clipped or shrunk away.
   */
  it('wraps rather than clipping at 200% text', async () => {
    const cards = await measure(PHONE, 2)
    expect(cards).toHaveLength(4)

    for (const card of cards) {
      expect(card.labelClipped, `${card.label} is clipped at 200% text`).toBe(false)
      expect(card.height, `${card.label} collapsed at 200% text`).toBeGreaterThanOrEqual(MIN_TAP * 2)
    }
  })

  /**
   * AND ALL FOUR ARE STILL ON SCREEN. A 2x2 grid that grows into a 1x4
   * column, or a fourth card below the fold, is the enlargement having eaten
   * the thing it was meant to improve.
   */
  it('keeps the grid two across, with no sideways scroll', async () => {
    const { origin, close } = await serve(BUILD)
    const browser = await chromium.launch()
    try {
      const context = await browser.newContext({ viewport: { width: PHONE, height: 780 } })
      const page = await context.newPage()
      await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-type-card]')

      const { columns, overflows } = (await page.evaluate(`(() => {
        const cards = [...document.querySelectorAll('[data-type-card]')]
        const lefts = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left)))
        return {
          columns: lefts.size,
          overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }
      })()`)) as { columns: number; overflows: boolean }

      expect(columns, 'the 2x2 grid collapsed').toBe(2)
      expect(overflows, 'the page scrolls sideways at 360px').toBe(false)
    } finally {
      await browser.close()
      await close()
    }
  })
})
