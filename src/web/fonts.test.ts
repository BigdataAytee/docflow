/**
 * The font stack names only fonts that exist (§F, §V, and licence check 19).
 *
 * THE FINDING THIS WAS WRITTEN FOR. `tailwind.config.js` has named
 * `"Plus Jakarta Sans"` first in the sans stack since the design system was
 * set up, and no font file is bundled and no `@font-face` rule exists — so
 * every screen has silently fallen back to Inter or the system UI font. §F
 * asks for it "bundled and loaded locally… Bundle every font the sixteen
 * templates actually use (audit them)", and §V forbids fetching one from a
 * CDN, so the fallback was not a workaround: it was the only behaviour
 * available, happening quietly.
 *
 * Two ways to make this true, and the test accepts either:
 *
 *  · bundle the file and add the `@font-face` — which also means recording
 *    its licence, since Plus Jakarta Sans is OFL and OFL requires the notice
 *    to travel with the font; or
 *  · stop naming it, and let the stack say what the app actually renders in.
 *
 * What it refuses is the third state — naming a font nobody ships — because
 * that is a design system describing a product that does not exist, and
 * whichever way it gets fixed, it should not go back.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = (...parts: string[]): string => join(process.cwd(), ...parts)

/** Every family named in the Tailwind stack, minus the generic keywords. */
function namedFamilies(): string[] {
  const config = readFileSync(root('tailwind.config.js'), 'utf8')
  const block = config.slice(config.indexOf('fontFamily:'))
  const quoted = [...block.slice(0, 600).matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '')
  return quoted
    .map((entry) => entry.replaceAll('"', '').trim())
    .filter(
      (entry) =>
        entry !== '' &&
        !['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif'].includes(entry) &&
        // Fallbacks a device supplies itself are not ours to bundle.
        !['Inter', '-apple-system', 'Segoe UI', 'Georgia', 'Times New Roman'].includes(entry),
    )
}

/** Font files shipped with the app, wherever they were put. */
function bundledFonts(): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name)
      if (entry.isDirectory()) walk(child)
      else if (/\.(woff2?|ttf|otf)$/i.test(entry.name)) found.push(entry.name)
    }
  }
  walk(root('public'))
  walk(root('src', 'assets'))
  return found
}

const faceRules = (): string =>
  existsSync(root('src', 'index.css')) ? readFileSync(root('src', 'index.css'), 'utf8') : ''

describe('Every font the stack names is a font the app ships (§F, §V)', () => {
  it('names no family without a file behind it', () => {
    const named = namedFamilies()
    const files = bundledFonts().join(' ').toLowerCase()
    const css = faceRules()

    for (const family of named) {
      const slug = family.replaceAll(' ', '').toLowerCase()
      const shipped = files.includes(slug) || css.includes(`@font-face`) === true && css.includes(family)
      expect(
        shipped,
        `"${family}" is first in the stack and nothing ships it — either bundle it ` +
          '(and record its licence) or stop naming it. Silently falling back to a ' +
          'system font is a design system describing a product that does not exist.',
      ).toBe(true)
    }
  })

  /**
   * §V is explicit: "No CDN dependency in the installed app — the prototype's
   * webfont links are prototype-only." A bundled font is the only shape this
   * app is allowed to have, so a stylesheet link would be a different bug
   * wearing the same clothes.
   */
  it('fetches no font from a network', () => {
    const css = faceRules()
    const html = readFileSync(root('index.html'), 'utf8')
    for (const source of [css, html]) {
      expect(source).not.toContain('fonts.googleapis.com')
      expect(source).not.toContain('fonts.gstatic.com')
      expect(source).not.toMatch(/@import\s+url\(['"]?https?:/)
    }
  })
})
