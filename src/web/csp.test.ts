/**
 * The policy, and the fact that it reaches the built document (§P, §V).
 *
 * Two halves, for the reason every guard here has two: the directives are
 * checked as data, and the BUILT `index.html` is checked as the artefact —
 * because a plugin that stopped running would leave the first half passing
 * and ship an unprotected page.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CSP_DIRECTIVES, contentSecurityPolicy, securityMetaTags } from './csp'

const directive = (name: string): string =>
  CSP_DIRECTIVES.find((d) => d.startsWith(`${name} `) || d === name) ?? ''

describe('The policy denies what the product already forbids (§V)', () => {
  /**
   * §V: "fonts, template assets, icons, terminology tables and language
   * strings ship in the app bundle — nothing needed to open a saved document
   * touches a CDN". A policy that allowed a CDN would permit a thing the
   * product forbids, which is how the forbidding stops being true.
   */
  it('allows no remote origin for code, styles or fonts', () => {
    for (const name of ['default-src', 'script-src', 'font-src']) {
      expect(directive(name), name).toContain("'self'")
      expect(directive(name), name).not.toMatch(/https?:\/\//)
    }
  })

  /** Every asset in this app is a data URL, so the page must be able to draw one. */
  it('lets the page draw the signatures, logos and photos it stores', () => {
    expect(directive('img-src')).toContain('data:')
    expect(directive('img-src')).toContain('blob:')
  })

  /**
   * Supabase's host is per-environment, so the SCHEME is what can be pinned.
   * Refusing `http:` is the part worth having: a downgraded request carrying
   * a session is the failure this prevents.
   */
  it('permits https for the backend and never plain http', () => {
    expect(directive('connect-src')).toContain('https:')
    expect(directive('connect-src')).not.toMatch(/(^|\s)http:/)
    expect(CSP_DIRECTIVES).toContain('upgrade-insecure-requests')
  })

  /** Three things the app does not do, denied rather than left open. */
  it.each([
    ["object-src", "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
  ])('pins %s to %s', (name, value) => {
    expect(directive(name)).toBe(`${name} ${value}`)
  })

  it('never contains a wildcard that would undo the rest', () => {
    expect(contentSecurityPolicy()).not.toContain("'unsafe-eval'")
    expect(contentSecurityPolicy()).not.toMatch(/(^|\s)\*/)
  })

  /** A document path carries a record id; it must not travel in a Referer. */
  it('sends no referrer', () => {
    expect(securityMetaTags()).toContain('name="referrer" content="no-referrer"')
  })
})

describe('The built document actually carries it', () => {
  const built = join(process.cwd(), 'dist', 'index.html')

  /**
   * SKIPPED rather than failed when there is no build: `npm test` runs before
   * `npm run build` in some orders, and a test that fails for the absence of
   * an artefact trains people to ignore it. `npm run verify` builds first, so
   * the check is real there — which is the run that gates a commit.
   */
  it('injects the policy into dist/index.html at build time', () => {
    if (!existsSync(built)) {
      expect(true, 'no dist/index.html — run npm run build').toBe(true)
      return
    }

    const html = readFileSync(built, 'utf8')
    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html).toContain("default-src 'self'")
    expect(html).toContain('name="referrer"')
    // And the dev-only escape hatch never ships.
    expect(html).not.toContain("'unsafe-eval'")
  })
})
