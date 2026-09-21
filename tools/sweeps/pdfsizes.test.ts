/**
 * How big the type on a printed document actually is (§I, §H).
 *
 * THE UNIT IS THE WHOLE PROBLEM. The print path is written in px — the page
 * fixes its own coordinate space at A4-by-96dpi, 794px across for 210mm — and
 * `text-[9.5px]` reads like an ordinary small caption to anybody writing it.
 * On paper it is 7.1 POINT, which is below what a business document should
 * ever carry and well below what somebody reads at a gate in the evening. The
 * number in the class could never have told them that, because the number was
 * in the wrong unit.
 *
 * So this converts, and asserts in points:
 *
 *     8pt    nothing on the page may be smaller, whatever it is for
 *     8.5pt  labels, headings, dates, addresses — read deliberately
 *     10pt   the line items, the party, the totals lines, the payment box
 *     14pt   the payable, and it must be bold
 *
 * MEASURED IN A BROWSER, ACROSS ALL SIXTEEN DESIGNS. Each design places its
 * own title, name, dates and amount, so a size under the floor in one of them
 * is invisible from every other — and no route in the app shows more than the
 * single design a document was saved with. `sizes.html` renders all sixteen
 * against a document of each type, at exactly 794px so the page's own `zoom`
 * resolves to 1 and a computed font-size IS a page px.
 *
 * Reading the classes instead would assert what was typed. This asserts what
 * Chromium resolved, which is the only thing that reaches the paper.
 *
 * `npm run sweep:pdfsizes`. Not in `npm test`: CI does not download a browser.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

import { BUILD, serve } from './serve'

/** Exact: 72 points to the inch over 96 CSS px to the inch. */
const ptOf = (px: number): number => px * (72 / 96)

/** The floors, in points. Mirrors `src/pdf/typeScale.ts`. */
const MIN_PT = { any: 8, secondary: 8.5, body: 10, total: 14 }

interface Measured {
  readonly sheet: string
  /** How the sweep classified it, from where it sits in the page. */
  readonly role: 'any' | 'secondary' | 'body' | 'total'
  readonly px: number
  readonly weight: number
  readonly text: string
}

/**
 * Walks every text node that will print, and says how big it is.
 *
 * ROLE COMES FROM POSITION, not from a class. A table cell is body because it
 * is a cell; the payable is the total because it is the element the page
 * marks as the figure. Classifying by class name would let a size and its own
 * floor be changed together, which is a guard agreeing with whatever it finds.
 *
 * THE FIGURE, NOT THE BLOCK AROUND IT. Keying on the receipt's whole evidence
 * block read its "Paid now" caption as a total and failed sixteen designs for
 * it — the caption is a caption, and it is small on purpose. What has to be
 * 14pt and bold is the number.
 *
 * Passed as SOURCE — this half of the build has no DOM lib, so the browser
 * compiles it and the shape is asserted on the way back.
 */
const WALK = [
  '(() => {',
  '  const out = []',
  "  for (const sheet of document.querySelectorAll('[data-sheet]')) {",
  "    const name = sheet.getAttribute('data-sheet')",
  '    const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT)',
  '    let node',
  '    while ((node = walker.nextNode())) {',
  "      const text = (node.textContent || '').trim()",
  "      if (text === '') continue",
  '      const el = node.parentElement',
  '      if (el === null) continue',
  '      const style = getComputedStyle(el)',
  "      if (style.visibility === 'hidden' || style.display === 'none') continue",
  '      /* Text drawn at zero opacity is decoration, not reading. */',
  '      if (parseFloat(style.opacity) === 0) continue',
  '      const role =',
  "        el.closest('[data-total-figure]') !== null",
  "          ? 'total'",
  "          : el.closest('td') !== null || el.closest('[data-note-block]') !== null",
  "            ? 'body'",
  "            : el.closest('th') !== null || el.tagName === 'DT'",
  "              ? 'secondary'",
  "              : 'any'",
  '      out.push({',
  '        sheet: name,',
  '        role,',
  '        px: parseFloat(style.fontSize),',
  '        weight: parseInt(style.fontWeight, 10) || 400,',
  '        text: text.slice(0, 40),',
  '      })',
  '    }',
  '  }',
  '  return out',
  '})()',
].join('\n')

const OVERFLOW = [
  '(() => {',
  '  const bad = []',
  "  for (const sheet of document.querySelectorAll('[data-sheet]')) {",
  "    const article = sheet.querySelector('article')",
  '    if (article === null) continue',
  '    const content = article.lastElementChild',
  '    if (content === null) continue',
  '    const over = content.scrollHeight - content.clientHeight',
  "    if (over > 1) bad.push({ sheet: sheet.getAttribute('data-sheet'), over })",
  '  }',
  '  return bad',
  '})()',
].join('\n')

/**
 * Labels that no longer fit the column holding them.
 *
 * A `dt` is one line by design — it is the left half of a two-column row, and
 * the whole reason it has a fixed width is so the values beside it align.
 *
 * COUNTED IN LINE BOXES, over a range across the label's own text. Measuring
 * the element's HEIGHT does not work and quietly reports the wrong rows: a
 * flex item stretches to the height of its row, so a `dt` whose one word fits
 * perfectly is as tall as the wrapped `dd` beside it. That misread "Account
 * name" in the sidebar design as broken when the address next to it was what
 * had wrapped. A range asks how many lines the TEXT occupies, which is the
 * question.
 */
const WRAPPED_LABELS = [
  '(() => {',
  '  const out = []',
  "  for (const sheet of document.querySelectorAll('[data-sheet]')) {",
  "    for (const dt of sheet.querySelectorAll('dt')) {",
  "      if (dt.textContent.trim() === '') continue",
  '      const range = document.createRange()',
  '      range.selectNodeContents(dt)',
  '      if (range.getClientRects().length > 1) {',
  "        out.push({ sheet: sheet.getAttribute('data-sheet'), text: dt.textContent.trim() })",
  '      }',
  '    }',
  '  }',
  '  return out',
  '})()',
].join('\n')

const open = async () => {
  const { origin, close } = await serve(BUILD)
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1000, height: 1400 } })
  const page = await context.newPage()
  await page.goto(`${origin}/sizes.html`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-sheet]')
  return {
    page,
    done: async () => {
      await browser.close()
      await close()
    },
  }
}

const measure = async (): Promise<Measured[]> => {
  const { page, done } = await open()
  try {
    return (await page.evaluate(WALK)) as Measured[]
  } finally {
    await done()
  }
}

/** The worst few, named, so a failure says what to open rather than a count. */
const worst = (rows: readonly Measured[]) =>
  [...rows]
    .sort((a, b) => a.px - b.px)
    .slice(0, 6)
    .map((row) => `${row.sheet} — "${row.text}" at ${ptOf(row.px).toFixed(2)}pt`)
    .join('\n  ')

describe.runIf(process.env.SWEEP === '1')('Printed type is big enough to read (§I)', () => {
  it('measures every design against a document of every type', async () => {
    expect(existsSync(join(BUILD, 'sizes.html')), 'build it first: npm run shots:build').toBe(true)

    const rows = await measure()
    /*
     * Sixteen designs times four types, each drawn to its last page. A sweep
     * that quietly measured one design would pass while fifteen were wrong,
     * and the count is the only thing that can tell the difference. Counted
     * by DOCUMENT rather than by sheet, because how many pages one takes is
     * exactly what this pass changes.
     */
    const documents = new Set(rows.map((row) => row.sheet.split(':').slice(0, 2).join(':')))
    expect(documents.size, `only ${documents.size} documents rendered`).toBe(64)
    /* And every one of them reached its footer, or the bottom of the page is
       not being measured at all — which is how the first run of this sweep
       found no total on any of the sixty-four. */
    const withFooter = new Set(
      rows.filter((row) => row.role === 'total').map((row) => row.sheet.split(':').slice(0, 2).join(':')),
    )
    expect(withFooter.size, 'some documents never drew their totals block').toBe(
      /* A delivery carries no money, so it has no total and never will. */
      documents.size - 16,
    )
    expect(rows.length).toBeGreaterThan(4000)
  }, 180_000)

  it('puts nothing on the paper below 8pt', async () => {
    const rows = await measure()
    const under = rows.filter((row) => ptOf(row.px) < MIN_PT.any - 1e-9)
    expect(under.length, `${under.length} text nodes print below 8pt:\n  ${worst(under)}`).toBe(0)
  }, 180_000)

  it('keeps labels, headings and the like at 8.5pt or more', async () => {
    const rows = (await measure()).filter((row) => row.role === 'secondary')
    expect(rows.length, 'no secondary text was found to measure').toBeGreaterThan(100)
    const under = rows.filter((row) => ptOf(row.px) < MIN_PT.secondary - 1e-9)
    expect(under.length, `${under.length} labels print below 8.5pt:\n  ${worst(under)}`).toBe(0)
  }, 180_000)

  /** The goods, the amounts, the note: everything somebody has to read. */
  it('keeps the body of the document at 10pt or more', async () => {
    const rows = (await measure()).filter((row) => row.role === 'body')
    expect(rows.length, 'no body text was found to measure').toBeGreaterThan(500)
    const under = rows.filter((row) => ptOf(row.px) < MIN_PT.body - 1e-9)
    expect(under.length, `${under.length} body lines print below 10pt:\n  ${worst(under)}`).toBe(0)
  }, 180_000)

  /**
   * THE ONE FIGURE THE DOCUMENT IS ABOUT. 14pt and bold, because it is what
   * a person looks for first and checks last, and because a total reading at
   * the same weight as a subtotal is a total somebody has to hunt for.
   */
  it('prints the payable at 14pt, bold', async () => {
    const rows = (await measure()).filter((row) => row.role === 'total')
    expect(rows.length, 'no total was found to measure').toBeGreaterThan(40)

    const small = rows.filter((row) => ptOf(row.px) < MIN_PT.total - 1e-9)
    expect(small.length, `${small.length} totals print below 14pt:\n  ${worst(small)}`).toBe(0)

    const light = rows.filter((row) => row.weight < 700)
    expect(light.length, `${light.length} totals print lighter than bold`).toBe(0)
  }, 180_000)

  /**
   * AND THE PAGE STILL HOLDS IT.
   *
   * Bigger type is taller rows, and the A4 box is `overflow-hidden` — so the
   * failure mode of this whole pass is a last line, a signature or a payment
   * box quietly clipped off the bottom of the paper. Nothing about that is
   * visible in a font size; it needs the browser's own measurement of how far
   * the content ran.
   */
  it('keeps a full page of goods inside the paper', async () => {
    const { page, done } = await open()
    try {
      const over = (await page.evaluate(OVERFLOW)) as { sheet: string; over: number }[]
      const named = over
        .slice(0, 8)
        .map((row) => `${row.sheet} by ${Math.round(row.over)}px`)
        .join('\n  ')
      expect(over.length, `content runs off the paper on ${over.length} sheets:\n  ${named}`).toBe(0)
    } finally {
      await done()
    }
  }, 180_000)

  /**
   * AND THE LABELS BESIDE THE VALUES STILL FIT THEIR COLUMN.
   *
   * The second thing bigger type breaks, and the one a size guard is blind
   * to: the payment box and the receipt's evidence put labels in a fixed
   * column so the values line up, and that column was sized for 10px text.
   * At the size the print floor asks for, "Account number" and "Balance
   * remaining" both broke over two lines — on the block that tells somebody
   * where to send money. Every size on the page was correct while that was
   * happening, because the fault was in the column, not the type.
   */
  it('fits every label beside its value on one line', async () => {
    const { page, done } = await open()
    try {
      const wrapped = (await page.evaluate(WRAPPED_LABELS)) as {
        sheet: string
        text: string
      }[]
      const named = [...new Set(wrapped.map((row) => `"${row.text}" in ${row.sheet}`))]
        .slice(0, 8)
        .join('\n  ')
      expect(wrapped.length, `${wrapped.length} labels wrap their column:\n  ${named}`).toBe(0)
    } finally {
      await done()
    }
  }, 180_000)
})

/**
 * The scale is written twice — as numbers and as Tailwind classes — because
 * Tailwind's scanner reads source text and cannot evaluate a template string.
 * Two spellings of one fact drift, so this holds them together. It needs no
 * browser, so it runs with the rest of the suite.
 */
describe('The scale agrees with itself (§I)', () => {
  it('spells every role the same in both halves', async () => {
    const source = readFileSync(join(process.cwd(), 'src/pdf/typeScale.ts'), 'utf8')
    const { TYPE, TEXT } = await import('../../src/pdf/typeScale')
    const sizes: Record<string, number> = TYPE
    const classes: Record<string, string> = TEXT

    for (const [role, px] of Object.entries(sizes)) {
      expect(classes[role], `${role} has no class`).toBe(`text-[${px}px]`)
    }
    /*
     * And the literal really is in the file the scanner reads, so the class
     * exists in the stylesheet rather than resolving to the page's 16px base.
     */
    for (const className of Object.values(classes)) {
      expect(source.includes(className), `${className} is not written out`).toBe(true)
    }
  })

  /** Every role clears the floor it exists to clear. */
  it('puts every role over its own floor', async () => {
    const { TYPE, MIN_PT: floors, ptOf: convert } = await import('../../src/pdf/typeScale')
    expect(convert(TYPE.micro)).toBeGreaterThanOrEqual(floors.any)
    expect(convert(TYPE.caption)).toBeGreaterThanOrEqual(floors.secondary)
    expect(convert(TYPE.body)).toBeGreaterThanOrEqual(floors.body)
    expect(convert(TYPE.lead)).toBeGreaterThanOrEqual(floors.body)
    expect(convert(TYPE.total)).toBeGreaterThanOrEqual(floors.total)
  })
})
