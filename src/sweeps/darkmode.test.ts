/**
 * The dark-mode sweep (§Q Phase 7, §G, §V, §F).
 *
 * This file used to measure a gap: 245 surfaces painted literal `bg-white`,
 * zero `dark:` variants, no dark tokens. Dark mode is now built, and what it
 * measures is the property that keeps it built.
 *
 * **The mechanism is tokens, not `dark:` variants.** `bg-surface/70` is one
 * class that is right in both themes, resolved through a CSS variable — so a
 * screen written tomorrow gets dark mode without its author remembering
 * anything, which is the only version of this that survives contact with a
 * growing app. There are still zero `dark:` variants, and that is the design
 * rather than the gap.
 *
 * Two things the sweep learned the hard way and now guards:
 *
 * · A literal `bg-white` is invisible to a theme.
 * · So is an inline `style={{ backgroundColor: … }}`, and that is worse,
 *   because no class scan can see it. The status badges were exactly this:
 *   pale-blue-on-white pills over a dark page, applied through inline styles
 *   from a map of hex.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

/** The PDF is PAPER. It stays light in both themes, and is not swept. */
const PAPER = 'src/pdf/'

const componentFiles = (): string[] =>
  execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(
      (file) => /\.tsx$/.test(file) && !/\.test\.tsx$/.test(file) && !file.startsWith(PAPER),
    )

const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8')

const HARD_SURFACE = /\b(?:bg|border|ring|divide)-(?:white|black)(?:\/[0-9.[\]]+)?\b/g

describe('Every surface goes through a token (§F)', () => {
  it('paints nothing with a literal white or black', () => {
    const findings = componentFiles().flatMap((file) =>
      (read(file).match(HARD_SURFACE) ?? []).map((hit) => `${file}: ${hit}`),
    )

    expect(findings, findings.join('\n')).toEqual([])
  })

  it('leaves `text-white` alone, because white on an accent is white in both', () => {
    // §F locks the type and brand accents in both themes, so the label on a
    // blue button is white on blue either way. Tokenising it would be wrong.
    const onAccent = componentFiles().flatMap((file) => read(file).match(/\btext-white\b/g) ?? [])

    expect(onAccent.length).toBeGreaterThan(0)
  })

  it('sets no theme-dependent colour through an inline style', () => {
    // The bug this catches: the status badges applied hex through
    // `style={{ color, backgroundColor }}` from a map, so they stayed
    // pale-on-white over a dark page — invisible to any class scan.
    const findings: string[] = []
    // Only the COLOUR properties, and only their own values. A hex inside a
    // `boxShadow` is a shadow, and the design-step swatch legitimately paints
    // a template's paper — paper is paper in both themes, like the PDF.
    const COLOUR_PROPERTY = /(?:backgroundColor|(?<![a-zA-Z])color)\s*:\s*([^,}]+)/g

    for (const file of componentFiles()) {
      /*
       * `[^}]*` stopped at the first `}` — and a template literal in a style
       * value contains one, in every `${...}`. So a style object whose FIRST
       * property interpolated anything hid every property after it, and the
       * step bar's theme-blind grey sat behind exactly that. Allowing one
       * level of nesting reaches the rest of the object.
       */
      for (const style of read(file).matchAll(/style=\{\{(?:[^{}]|\{[^{}]*\})*\}\}/g)) {
        for (const property of style[0].matchAll(COLOUR_PROPERTY)) {
          const value = property[1] ?? ''
          if (/#[0-9a-fA-F]{3,8}/.test(value)) findings.push(`${file}: ${property[0].slice(0, 60)}`)
        }
      }
    }

    expect(findings, findings.join('\n')).toEqual([])
  })
})

describe('Both themes exist, and the document says which it is in', () => {
  const css = (): string => read('src/index.css')

  it('declares a colour scheme per theme', () => {
    expect(css()).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/)
    expect(css()).toMatch(/\.dark\s*\{[^}]*color-scheme:\s*dark/)
  })

  it('gives every themed token a value in both', () => {
    // Sliced on the SELECTORS, not on the first mention of the word: the
    // commentary above `.dark` refers to it, and slicing there cut the light
    // block off before a single variable — a check that then passed by
    // finding nothing to check.
    const text = css()
    const lightAt = text.indexOf(':root {')
    const darkAt = text.indexOf('.dark {')
    expect(lightAt).toBeGreaterThan(-1)
    expect(darkAt).toBeGreaterThan(lightAt)

    const light = text.slice(lightAt, darkAt)
    const dark = text.slice(darkAt)
    const names = [...light.matchAll(/--([a-z-]+):/g)].map((match) => match[1])

    expect(names.length).toBeGreaterThan(10)
    for (const name of names) {
      expect(dark.includes(`--${name}:`), `--${name} has no dark value`).toBe(true)
    }
  })

  it('keeps §F’s locked accents identical in both themes', () => {
    // §F is marked Locked and says colours belong to the internal type. A dark
    // theme may change what an accent sits ON, never the accent.
    const config = read('tailwind.config.js')

    for (const locked of ['#2b3fd6', '#534AB7', '#0F6E56', '#BA7517']) {
      expect(config, `${locked} is no longer a fixed accent`).toContain(locked)
    }
    expect(css()).not.toContain('#534AB7')
  })
})

describe('Every opacity modifier actually produces a colour', () => {
  /**
   * `border-ink/8` produced NOTHING.
   *
   * Tailwind's default opacity scale runs in steps of five, so `/8` matches no
   * utility and the border silently fell back to Tailwind's default colour — a
   * light grey. On a white page that is invisibly wrong; the moment the page
   * went dark it became a hard white rule between every row in the list. The
   * class had been there since Phase 2, doing nothing anybody could see.
   */
  // Tailwind's default scale is every five from 0 to 100 — nothing else.
  const SCALE = new Set(Array.from({ length: 21 }, (_, i) => i * 5))

  it('uses only opacities Tailwind emits', () => {
    const findings: string[] = []

    for (const file of componentFiles()) {
      for (const match of read(file).matchAll(
        /\b(?:bg|text|border|divide|ring|from|via|to)-[a-z-]+\/(\d+)\b/g,
      )) {
        const step = Number(match[1])
        if (!SCALE.has(step)) findings.push(`${file}: ${match[0]} — not on the default scale`)
      }
    }

    expect(findings, findings.join('\n')).toEqual([])
  })
})
