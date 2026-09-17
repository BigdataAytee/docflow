/**
 * A safe-area inset must never be the thing that sets a screen's padding.
 *
 * THE BUG. `index.css` carried this, and it reads as obviously correct:
 *
 *     .native main { padding-inline-start: env(safe-area-inset-left, 0px) }
 *
 * Two facts make it destructive together. `padding-inline-start` IS
 * `padding-left` in a left-to-right language, so it does not sit alongside
 * Tailwind's `px-5` — it competes with it. And `.native main` has specificity
 * (0,1,1) against `.px-5`'s (0,1,0), so it wins. Every screen whose `<main>`
 * set its own horizontal padding therefore had that padding REPLACED by the
 * inset, which on a phone held upright is `0px`. Text ran into both edges of
 * the display, on every screen, on the device only.
 *
 * Chromium at 320px cannot see it: `env()` resolves to the fallback there too,
 * but the `.native` class is only ever added inside the shell, so the rule
 * does not apply and the responsive sweep passes. That is why this is a source
 * assertion rather than a rendering one — the defect lives in the interaction
 * between a selector's specificity and a utility class, and it is visible in
 * the stylesheet long before it is visible on a phone.
 *
 * The rule: insets belong on `body`, the element that actually meets the
 * display's edge, where they ADD to whatever a screen chose for itself.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Comments are stripped BEFORE parsing. The prose in this stylesheet explains
 * the very defect being guarded against, braces and all, so a scan that reads
 * comments finds the bug quoted in a comment and fails on the fix.
 */
const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

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

describe('Safe-area insets do not overwrite a screen’s own padding', () => {
  it('sets horizontal insets on `body` and nowhere else under `.native`', () => {
    const offenders = rules(css)
      .filter((rule) => rule.selector.includes('.native'))
      .filter((rule) => HORIZONTAL.test(rule.body))
      .filter((rule) => !/\.native\s+body\b|\.native\s*body\b/.test(rule.selector))
      .map((rule) => rule.selector)

    // `[data-safe-*]` opt-ins are fine: an attribute an element asks for is a
    // choice, not something imposed on every `<main>` in the app.
    const imposed = offenders.filter((selector) => !selector.includes('['))

    expect(imposed, `these would outrank Tailwind's px-* utilities: ${imposed.join(', ')}`).toEqual(
      [],
    )
  })

  /**
   * `min-h-screen` is `100vh` — the whole display, including the strip the
   * top inset has just pushed the page out of. Without an override, every
   * full-height screen is exactly one inset taller than the room it has.
   */
  it('shortens full-height screens by the insets it just added', () => {
    const rule = rules(css).find((r) => r.selector.includes('.native .min-h-screen'))
    expect(rule, '.native .min-h-screen must be overridden').toBeDefined()
    expect(rule?.body).toMatch(/safe-area-inset-top/)
    // `dvh`, not `vh`: a form centred in the full display height is centred
    // behind the keyboard covering half of it.
    expect(rule?.body).toMatch(/dvh/)
  })
})
