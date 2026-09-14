/**
 * Does the app read in the order it looks? (§V, D12.)
 *
 * The rules are pure over captured boxes, so they run in `npm test`; only the
 * capture needs a browser. `npm run sweep:screenreader` drives it.
 */

import { describe, expect, it } from 'vitest'

import { type Box, inversionOf, reportOf, visualOrder } from './readingorder'

/** Height defaults to a line of text; the row cases set it explicitly. */
const box = (
  index: number,
  top: number,
  start: number,
  label = `item ${index}`,
  height = 20,
): Box => ({ index, top, bottom: top + height, start, label })

describe('Reading order, against visual order', () => {
  it('is happy when the two agree', () => {
    expect(inversionOf('/', 'ul', [box(0, 0, 0), box(1, 40, 0), box(2, 80, 0)])).toBeNull()
  })

  it('catches a row reversed by CSS', () => {
    // `flex-direction: row-reverse` or `order:` — the first child in the DOM
    // sits last on the screen, so what is heard and what is seen are two
    // different documents.
    const found = inversionOf('/', 'div.actions', [box(0, 0, 200, 'button Cancel'), box(1, 0, 0, 'button Save')])

    expect(found?.heard).toEqual(['button Cancel', 'button Save'])
    expect(found?.seen).toEqual(['button Save', 'button Cancel'])
  })

  it('catches a block moved above its predecessor', () => {
    const found = inversionOf('/', 'section', [box(0, 100, 0, 'h2 Totals'), box(1, 0, 0, 'h2 Items')])
    expect(found?.seen).toEqual(['h2 Items', 'h2 Totals'])
  })

  it('treats overlapping boxes as one line, however their tops line up', () => {
    // The false positive that taught this rule: a row with `items-center`
    // holding a 20px label beside a 44px button puts the label's top twelve
    // pixels lower. Comparing tops called four settings screens broken.
    const tall = box(1, 0, 40, 'button Edit', 44)
    const short = box(0, 12, 0, 'span INV-001', 20)
    expect(inversionOf('/', 'div.row', [short, tall])).toBeNull()
  })

  it('still catches a real stack, where nothing overlaps', () => {
    expect(inversionOf('/', 'div', [box(0, 60, 0), box(1, 0, 40)])).not.toBeNull()
  })

  it('calls boxes that merely graze each other stacked', () => {
    // A one-pixel kiss is two rows, not one.
    const first = box(0, 0, 0, 'first', 20)
    const second = box(1, 19, 40, 'second', 20)
    expect(visualOrder([second, first]).map((b) => b.label)).toEqual(['first', 'second'])
  })

  it('says nothing about a single child, which cannot be out of order', () => {
    expect(inversionOf('/', 'div', [box(0, 0, 0)])).toBeNull()
    expect(inversionOf('/', 'div', [])).toBeNull()
  })

  it('reads a right-to-left page from the right', () => {
    // The scan negates `right` for RTL, so "first" is the start edge in both
    // directions and one comparison serves both (§V: RTL mirrors completely).
    const ordered = visualOrder([box(0, 0, -300, 'first'), box(1, 0, -100, 'second')])
    expect(ordered.map((b) => b.label)).toEqual(['first', 'second'])
  })

  it('reports both orders, so somebody can see what moved', () => {
    const report = reportOf(
      [{ route: '/doc/1', parent: 'div.actions', heard: ['a', 'b'], seen: ['b', 'a'] }],
      21,
    )
    expect(report).toContain('/doc/1')
    expect(report).toContain('heard: a → b')
    expect(report).toContain('seen:  b → a')
    expect(reportOf([], 21)).toContain('21 routes')
  })
})
