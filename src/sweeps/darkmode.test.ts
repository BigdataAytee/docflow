/**
 * The dark-mode sweep (§Q Phase 7, §G, §V).
 *
 * §G lists "Dark mode" as a Settings row and §V requires the glass layer to
 * degrade cleanly. **Dark mode is not implemented**, and this file exists to
 * say so with a number rather than an impression, and to stop the gap being
 * papered over.
 *
 * The state found by the sweep: `darkMode: 'class'` configured, one `.dark
 * body` rule flipping two tokens, **zero `dark:` variants in any component**,
 * no dark tokens in the palette, and 245 surfaces painted literal `bg-white`,
 * `border-black`, `text-white` or `bg-black`. A toggle over that produces a
 * dark body behind unchanged white panels.
 *
 * What the sweep FIXED is the dishonest half: `:root` declared
 * `color-scheme: light dark`, which tells the browser the page handles both,
 * so a dark-preferring user got dark scrollbars and dark form controls around
 * a white app. §N: an unavailable capability is stated plainly, never dressed
 * up.
 *
 * What it did not fix is the feature. Repainting 245 surfaces is a design
 * decision about the §F glass layer, not a find-and-replace, and doing it
 * badly would be worse than the honest light-only app there is now.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

const componentFiles = (): string[] =>
  execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((file) => /\.tsx$/.test(file) && !/\.test\.tsx$/.test(file))

const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8')

const HARD_SURFACE = /\b(?:bg|text|border|ring|divide)-(?:white|black)(?:\/[0-9.[\]]+)?\b/g

function hardSurfaces(): string[] {
  return componentFiles().flatMap((file) => read(file).match(HARD_SURFACE) ?? [])
}

const darkVariants = (): string[] =>
  componentFiles().flatMap((file) => read(file).match(/\bdark:[a-z0-9-]+/g) ?? [])

describe('The app does not claim a dark mode it does not have (§N)', () => {
  it('declares light only, because every surface is light', () => {
    const css = read('src/index.css')

    expect(css).toContain('color-scheme: light;')
    expect(css).not.toContain('color-scheme: light dark')
  })

  it('couples the declaration to the implementation', () => {
    // The pair is the point: either the app tells the browser it handles dark
    // AND components carry dark variants, or it declares light. Half of each
    // is what produced dark scrollbars around white panels.
    const css = read('src/index.css')
    const claimsDark = css.includes('color-scheme: light dark') || css.includes('color-scheme: dark')

    if (claimsDark) {
      expect(
        darkVariants().length,
        'the page claims dark support and no component has a dark: variant',
      ).toBeGreaterThan(0)
    } else {
      expect(darkVariants()).toEqual([])
    }
  })
})

describe('The size of the gap, measured rather than guessed', () => {
  it('counts the surfaces a dark mode would have to repaint', () => {
    const surfaces = hardSurfaces()

    // Not a target to chip away at — a number that says why dark mode is a
    // design decision rather than a find-and-replace. If it grows a lot, the
    // work grew; if it collapses, somebody built the tokens and this test
    // should be rewritten to check them.
    expect(surfaces.length).toBeGreaterThan(200)
    expect(surfaces.length).toBeLessThan(320)
  })

  it('has no dark tokens in the palette to point them at', () => {
    const config = read('tailwind.config.js')

    // `page` and `navy` are the light pair the body already uses. A dark mode
    // needs surface/ink tokens the 245 usages above can move onto.
    expect(config).not.toContain('surface-dark')
    expect(config).not.toContain('ink-dark')
  })
})
