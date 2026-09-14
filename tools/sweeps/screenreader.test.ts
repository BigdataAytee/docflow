/**
 * Running the screen-reader sweep against the real app.
 *
 * Two halves, deliberately. The RULES are pure over a captured accessibility
 * tree, so they run in `npm test` with no browser — which is what makes them
 * mutation-testable and what keeps a broken rule from passing silently. The
 * CAPTURE needs Chromium, so it is gated behind `npm run sweep:screenreader`
 * like the other browser sweeps.
 *
 * The tree comes from CDP rather than Playwright's `accessibility.snapshot()`:
 * the snapshot prunes "uninteresting" nodes, and this audit is looking for
 * exactly the nodes something else decided were uninteresting.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'

import { type AxNode, DOM_AUDIT, type Finding, type Rule, auditTree, reportOf } from './screenreader'
import { BUILD, ROUTES, serve } from './responsive.test'

/** Builds a tree the way CDP hands one over: flat, linked by childIds. */
function tree(...nodes: readonly Partial<AxNode & { role: string; name: string; children: string[] }>[]) {
  return nodes.map((node, index) => ({
    nodeId: String(index),
    role: { value: node.role ?? 'generic' },
    name: { value: node.name ?? '' },
    childIds: node.children ?? [],
    properties: node.properties ?? [],
    ignored: node.ignored ?? false,
  })) as AxNode[]
}

const level = (n: number) => [{ name: 'level', value: { value: n } }]
const focusable = [{ name: 'focusable', value: { value: true } }]
const url = (u: string) => [{ name: 'url', value: { value: u } }]

describe('The rules a screen reader would stumble on', () => {
  it('wants exactly one main landmark', () => {
    const none = auditTree('/', tree({ role: 'RootWebArea', children: ['1'] }, { role: 'navigation' }))
    expect(none.map((f) => f.rule)).toContain('no-main')

    const one = auditTree('/', tree({ role: 'RootWebArea', children: ['1'] }, { role: 'main' }))
    expect(one.map((f) => f.rule)).not.toContain('no-main')

    const two = auditTree(
      '/',
      tree({ role: 'RootWebArea', children: ['1', '2'] }, { role: 'main' }, { role: 'main' }),
    )
    expect(two.map((f) => f.rule)).toContain('many-mains')
  })

  it('wants the first heading to be level 1 and no level skipped', () => {
    const starts = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1', '2'] },
        { role: 'main', children: [] },
        { role: 'heading', name: 'Needs attention', properties: level(2) },
      ),
    )
    expect(starts.find((f) => f.rule === 'heading-jump')?.detail).toContain('first heading is level 2')

    const skips = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1', '2', '3'] },
        { role: 'main' },
        { role: 'heading', name: 'Invoice', properties: level(1) },
        { role: 'heading', name: 'Number & dates', properties: level(3) },
      ),
    )
    expect(skips.find((f) => f.rule === 'heading-jump')?.detail).toContain('level 1 → 3')

    const fine = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1', '2', '3', '4'] },
        { role: 'main' },
        { role: 'heading', name: 'Invoice', properties: level(1) },
        { role: 'heading', name: 'Items', properties: level(2) },
        { role: 'heading', name: 'Totals', properties: level(2) },
      ),
    )
    expect(fine.map((f) => f.rule)).not.toContain('heading-jump')
  })

  it('reads document order from the links, not from the array', () => {
    // CDP returns a flat array whose order is not document order. Here the
    // level-2 heading is LISTED first and is the SECOND child; a rule that
    // trusted the array would call this well-formed page a jump.
    const heading = (nodeId: string, name: string, n: number): AxNode => ({
      nodeId,
      role: { value: 'heading' },
      name: { value: name },
      properties: level(n),
      childIds: [],
    })
    const found = auditTree('/', [
      { nodeId: 'root', role: { value: 'RootWebArea' }, name: { value: '' }, childIds: ['main'] },
      { nodeId: 'main', role: { value: 'main' }, name: { value: '' }, childIds: ['first', 'second'] },
      heading('second', 'Items', 2),
      heading('first', 'Invoice', 1),
    ])
    expect(found.map((f) => f.rule)).not.toContain('heading-jump')
  })

  it('catches a control with no name, and one named by a glyph', () => {
    const found = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1'] },
        { role: 'main', children: ['2', '3', '4'] },
        { role: 'button', name: '', properties: focusable },
        { role: 'button', name: '✕', properties: focusable },
        { role: 'button', name: 'Cancel', properties: focusable },
      ),
    )
    expect(found.filter((f) => f.rule === 'unnamed-control')).toHaveLength(1)
    expect(found.filter((f) => f.rule === 'glyph-name')).toHaveLength(1)
    expect(found.find((f) => f.rule === 'glyph-name')?.detail).toContain('✕')
  })

  it('accepts a name with no Latin letter in it', () => {
    const found = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1'] },
        { role: 'main', children: ['2', '3'] },
        { role: 'button', name: 'إلغاء', properties: focusable },
        { role: 'button', name: '取消', properties: focusable },
      ),
    )
    expect(found.filter((f) => f.rule === 'glyph-name')).toHaveLength(0)
  })

  it('flags two links that say the same thing and go somewhere different', () => {
    const same = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1'] },
        { role: 'main', children: ['2', '3'] },
        { role: 'link', name: 'Open', properties: url('/a') },
        { role: 'link', name: 'Open', properties: url('/a') },
      ),
    )
    expect(same.map((f) => f.rule)).not.toContain('ambiguous-link')

    const differs = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1'] },
        { role: 'main', children: ['2', '3'] },
        { role: 'link', name: 'Open', properties: url('/a') },
        { role: 'link', name: 'Open', properties: url('/b') },
      ),
    )
    expect(differs.find((f) => f.rule === 'ambiguous-link')?.detail).toContain('"Open"')
  })

  it('flags a landmark named after something inside it', () => {
    const collides = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1', '2'] },
        { role: 'main' },
        { role: 'navigation', name: 'Home', children: ['3', '4'] },
        { role: 'link', name: 'Home', properties: url('/') },
        { role: 'link', name: 'Settings', properties: url('/settings') },
      ),
    )
    expect(collides.find((f) => f.rule === 'landmark-name-collides')?.detail).toContain('"Home"')

    const named = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1', '2'] },
        { role: 'main' },
        { role: 'navigation', name: 'Sections', children: ['3'] },
        { role: 'link', name: 'Home', properties: url('/') },
      ),
    )
    expect(named.map((f) => f.rule)).not.toContain('landmark-name-collides')
  })

  it('flags a control that no landmark contains', () => {
    const outside = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1', '2'] },
        { role: 'main' },
        { role: 'button', name: 'Stranded', properties: focusable },
      ),
    )
    expect(outside.find((f) => f.rule === 'outside-landmark')?.detail).toContain('Stranded')

    const inside = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1'] },
        { role: 'main', children: ['2'] },
        { role: 'button', name: 'Held', properties: focusable },
      ),
    )
    expect(inside.map((f) => f.rule)).not.toContain('outside-landmark')
  })

  it('counts a dialog as a place, and flags a dialog named after its own field', () => {
    // A modal scopes the reader to itself, so its controls are not stranded —
    // but three things inside it saying the same words is the same fault as a
    // tab bar named after one of its links.
    const found = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1', '2'] },
        { role: 'main' },
        { role: 'dialog', name: 'Go anywhere', children: ['3'] },
        { role: 'combobox', name: 'Go anywhere', properties: focusable },
      ),
    )
    expect(found.map((f) => f.rule)).not.toContain('outside-landmark')
    expect(found.find((f) => f.rule === 'landmark-name-collides')?.detail).toContain('Go anywhere')

    const named = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1', '2'] },
        { role: 'main' },
        { role: 'dialog', name: 'Go anywhere', children: ['3'] },
        { role: 'combobox', name: 'Search, or jump to a page', properties: focusable },
      ),
    )
    expect(named).toEqual([])
  })

  it('walks through an ignored wrapper to the live control beneath it', () => {
    const found = auditTree(
      '/',
      tree(
        { role: 'RootWebArea', children: ['1'] },
        { role: 'main', children: ['2'] },
        { role: 'none', ignored: true, children: ['3'] },
        { role: 'button', name: '', properties: focusable },
      ),
    )
    expect(found.filter((f) => f.rule === 'unnamed-control')).toHaveLength(1)
  })

  it('says which rule fired, and where', () => {
    const report = reportOf(
      [{ route: '/settings', rule: 'no-main' as Rule, detail: 'the page has no main landmark' }],
      17,
    )
    expect(report).toContain('no-main')
    expect(report).toContain('/settings')
    expect(reportOf([], 17)).toContain('17 routes')
  })
})

/**
 * Two widths, because the app has two navigations and shows one at a time.
 * A sweep that only ever ran at phone width would never once have seen the
 * sidebar or the button that opens the palette.
 */
const WIDTHS = [390, 1280]

describe.runIf(process.env.SWEEP === '1')('The real app, through the accessibility tree (§V)', () => {
  it('audits every route, at a phone and at a desk', async () => {
    expect(existsSync(join(BUILD, 'shots.html')), 'build it first: npm run shots:build').toBe(true)

    const { origin, close } = await serve(BUILD)
    const browser = await chromium.launch()
    const findings: Finding[] = []

    try {
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: 844 } })
        const page = await context.newPage()
        const cdp = await context.newCDPSession(page)
        await cdp.send('Accessibility.enable')

        for (const route of ROUTES) {
          const where = `${route} @${width}`
          await page.goto(`${origin}${route}?region=NG`, { waitUntil: 'networkidle' })
          const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AxNode[] }
          findings.push(...auditTree(where, nodes))
          for (const [rule, detail] of (await page.evaluate(DOM_AUDIT)) as [Rule, string][]) {
            findings.push({ route: where, rule, detail })
          }
        }
        await context.close()
      }

      // And the palette, which no route URL reaches: it is opened with a
      // keystroke and audited with the dialog on screen, because a dialog is
      // exactly where unnamed controls and stranded focus hide.
      const context = await browser.newContext({ viewport: { width: 1280, height: 844 } })
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Accessibility.enable')
      await page.goto(`${origin}/?region=NG`, { waitUntil: 'networkidle' })
      await page.keyboard.press('Control+k')
      await page.waitForSelector('[role="dialog"]')
      const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AxNode[] }
      findings.push(...auditTree('/ with the palette open', nodes))
      for (const [rule, detail] of (await page.evaluate(DOM_AUDIT)) as [Rule, string][]) {
        findings.push({ route: '/ with the palette open', rule, detail })
      }
      await context.close()
    } finally {
      await browser.close()
      await close()
    }

    console.log(reportOf(findings, ROUTES.length * WIDTHS.length + 1))
    expect(findings, reportOf(findings, ROUTES.length * WIDTHS.length + 1)).toEqual([])
  }, 900_000)
})
