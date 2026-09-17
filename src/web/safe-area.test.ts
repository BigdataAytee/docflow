/**
 * Safe-area insets: counted once, and never instead of a screen's own padding.
 *
 * Two defects live here, both invisible outside a device, because `env()`
 * resolves to its fallback everywhere else and the `.native` class is only
 * ever added inside the shell. The responsive sweep at 320px in Chromium
 * cannot see either of them, which is why these are source assertions.
 *
 * ONE — the inset REPLACING a screen's padding. `index.css` carried:
 *
 *     .native main { padding-inline-start: env(safe-area-inset-left, 0px) }
 *
 * `padding-inline-start` IS `padding-left` in a left-to-right language, so it
 * competes with Tailwind's `px-5` rather than adding to it — and `.native main`
 * (0,1,1) outranks `.px-5` (0,1,0). Upright, the inset is `0px`. Every screen
 * with a `<main>` lost its horizontal padding and text ran into both edges.
 *
 * TWO — the inset counted TWICE. `PageHeader` already carries its own
 * `pt-[max(1rem,env(safe-area-inset-top))]`, and `.native body` carried a
 * `padding-top` as well. The result was a pale band across the top where §F
 * wants the header's gradient to reach the physical edge, and dead space above
 * every title.
 *
 * The rule that resolves both: a band that DRAWS at an edge pushes its own
 * content clear, and `body` handles only the left and right edges, which no
 * component handles for itself.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Strips block and line comments, so a scan never reads prose as code. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const read = (...parts: string[]): string =>
  readFileSync(join(process.cwd(), ...parts), 'utf8')

/*
 * Comments stripped BEFORE parsing. The prose in this stylesheet explains the
 * very defects being guarded against — braces, selectors and all — so a scan
 * that reads comments finds the bug quoted in a comment and fails on the fix.
 */
const css = stripComments(read('src', 'index.css'))

/** Every `selector { ... }` block, flattened enough to read declarations. */
function rules(source: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    found.push({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' })
  }
  return found
}

const HORIZONTAL = /padding-(inline(-start|-end)?|left|right)\s*:/

describe('An inset adds to a screen’s padding, it does not replace it', () => {
  it('sets horizontal insets on `body` and nowhere else under `.native`', () => {
    const offenders = rules(css)
      .filter((rule) => rule.selector.includes('.native'))
      .filter((rule) => HORIZONTAL.test(rule.body))
      .filter((rule) => !rule.selector.includes('.native body'))
      .map((rule) => rule.selector)

    // `[data-safe-*]` opt-ins are fine: an attribute an element asks for is a
    // choice, not something imposed on every `<main>` in the app.
    const imposed = offenders.filter((selector) => !selector.includes('['))

    expect(imposed, `these would outrank Tailwind's px-* utilities: ${imposed.join(', ')}`).toEqual(
      [],
    )
  })
})

describe('The top inset is counted once', () => {
  /**
   * `body` must not re-apply what every top band already applies. The pale
   * stripe under the status bar was this, and nothing else.
   */
  it('is not applied by `body` on top of the bands that apply it', () => {
    const bodyRules = rules(css).filter((rule) => rule.selector.includes('.native body'))

    /*
     * The scan found something. Without this the filter can silently match
     * nothing — it did once, on a stray character in the pattern — and an
     * assertion that a thing is ABSENT passes over an empty string while the
     * defect sits in the file. The mutation went green and said so.
     */
    expect(bodyRules.length, 'no `.native body` rule was found to check').toBeGreaterThan(0)

    const declarations = bodyRules.map((rule) => rule.body).join('\n')
    expect(declarations, 'body must not re-apply the top inset').not.toMatch(/padding-top\s*:/)
  })

  /**
   * EVERY band that draws behind the status bar clears its own content.
   *
   * `BuilderShell` did not — it had been living off the body's padding — so
   * the moment that was removed the builder's title sat underneath the clock.
   * Found by walking the app on a device, which is the only place `env()` is
   * anything but zero.
   */
  it.each([
    ['src/ui/PageHeader.tsx'],
    ['src/features/home/Home.tsx'],
    ['src/features/documents/BuilderShell.tsx'],
    ['src/app/screens/OnboardingScreen.tsx'],
  ])('%s clears the status bar itself', (file) => {
    /*
     * Comments stripped first, and that is not housekeeping. The comment on
     * `BuilderShell`'s header QUOTES the class it explains, so a scan that
     * reads comments finds the fix described in prose and passes with the fix
     * deleted — which is what happened, twice, before this line existed.
     */
    const source = stripComments(read(...file.split('/')))
    expect(source).toMatch(/pt-\[max\([^\]]*safe-area-inset-top/)
  })

  /**
   * `dvh`, not `vh`: a form centred in the full display height is centred
   * behind the keyboard covering half of it.
   */
  it('sizes full-height screens against the viewport the keyboard shrinks', () => {
    const rule = rules(css).find((r) => r.selector.includes('.native .min-h-screen'))
    expect(rule, '.native .min-h-screen must be overridden').toBeDefined()
    expect(rule?.body).toMatch(/dvh/)
  })
})
