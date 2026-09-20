/**
 * The two directives a document cannot carry (§P).
 *
 * `csp.ts` puts the whole policy inside the built `index.html`, which is the
 * only way to cover Capacitor as well as a web host. Two things cannot travel
 * that way, and both were listed in PLAN as somebody else's job:
 *
 *  · `frame-ancestors`, which browsers IGNORE in a meta policy, so the
 *    clickjacking protection the app believes it has is, on the web, absent;
 *  · HSTS, whose whole purpose is the request before the document loads.
 *
 * Three halves, for the reason every guard here has more than one: the values
 * as data, the EMITTED `_headers` as the artefact a host actually reads, and
 * the checked-in documentation, because a page of copy-paste server config is
 * exactly what goes stale silently.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CSP_DIRECTIVES } from './csp'
import {
  HOST_HEADERS,
  HSTS_MAX_AGE_SECONDS,
  headersDoc,
  headersFile,
  hostSnippets,
} from './headers'

const value = (name: string): string =>
  HOST_HEADERS.find((header) => header.name === name)?.value ?? ''

const DOC = join(process.cwd(), 'docs/deploy/web-headers.md')

describe('The header says what the document cannot (§P)', () => {
  /**
   * THE ONE THIS IS FOR. A meta policy carrying `frame-ancestors` is a policy
   * the browser throws away, so any page anywhere could put DocFlow in an
   * iframe and sit an invisible layer over "Record payment".
   */
  it('refuses framing outright', () => {
    expect(value('Content-Security-Policy')).toBe("frame-ancestors 'none'")
  })

  /**
   * ONLY that directive. A browser enforces a header and a meta policy
   * TOGETHER, so sending the whole thing twice would be two copies free to
   * drift — and the drift shows up as a screen breaking in production and
   * nowhere else.
   */
  it('carries nothing the document already carries', () => {
    const header = value('Content-Security-Policy')
    for (const directive of CSP_DIRECTIVES) {
      if (directive.startsWith('frame-ancestors')) continue
      expect(header, `the header repeats ${directive}`).not.toContain(directive.split(' ')[0] ?? '')
    }
  })

  /** And the document's own copy still names it, for readers of the policy. */
  it('agrees with the policy in the document', () => {
    expect(CSP_DIRECTIVES).toContain("frame-ancestors 'none'")
  })

  it('asks a browser to remember HTTPS for a year, including subdomains', () => {
    expect(HSTS_MAX_AGE_SECONDS).toBe(31_536_000)
    expect(value('Strict-Transport-Security')).toBe(
      `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    )
  })

  /**
   * NO `preload`. It is baked into browser binaries, removal takes months,
   * and it binds every current and future subdomain to HTTPS-only — the
   * owner's decision about their domain, not a default a build tool takes.
   */
  it('never submits the domain to the preload list on the owner\u2019s behalf', () => {
    expect(value('Strict-Transport-Security')).not.toContain('preload')
  })

  /** Every header says why it exists, and the reason travels into the docs. */
  it('explains each one', () => {
    for (const header of HOST_HEADERS) {
      expect(header.because.length, header.name).toBeGreaterThan(40)
    }
  })
})

describe('The file a host actually reads', () => {
  const file = headersFile()

  it('applies to every path, because both are about the origin', () => {
    expect(file).toContain('/*')
  })

  it.each(HOST_HEADERS.map((h) => [h.name, h.value]))('carries %s', (name, headerValue) => {
    expect(file).toContain(`  ${name}: ${headerValue}`)
  })

  /** Two spaces of indent under the path — the format's own rule. */
  it('indents them the way the format requires', () => {
    for (const line of file.split('\n')) {
      if (line.includes(': ') && !line.startsWith('#')) expect(line).toMatch(/^ {2}\S/)
    }
  })

  it('says where it came from, so nobody edits it by hand', () => {
    expect(file).toContain('src/web/headers.ts')
  })

  /**
   * THE ARTEFACT, not the intention. A plugin that stopped running would
   * leave every assertion above passing and ship a bundle with no `_headers`
   * beside it — which is the shape this whole file exists to catch.
   */
  it('is emitted into the build', () => {
    const built = join(process.cwd(), 'dist/_headers')
    if (!existsSync(built)) {
      expect(
        existsSync(join(process.cwd(), 'dist')),
        'dist is absent: run `npm run build` before this suite',
      ).toBe(false)
      return
    }
    expect(readFileSync(built, 'utf8')).toBe(file)
  })
})

describe('The deployment note stays in step', () => {
  /** Every server anybody is likely to put this on gets the same two values. */
  it('gives the same values to every host it names', () => {
    for (const { host, config } of hostSnippets()) {
      for (const header of HOST_HEADERS) {
        expect(config, host).toContain(header.value)
      }
    }
  })

  /**
   * GENERATED, then asserted. A page of server config kept by hand goes stale
   * silently, and the failure mode is a header somebody believes is set and
   * is not.
   */
  it('matches what the module produces', () => {
    const expected = headersDoc()
    if (process.env['UPDATE_HEADERS'] === '1') {
      writeFileSync(DOC, expected)
      return
    }
    expect(existsSync(DOC), 'run `npm run headers` to write it').toBe(true)
    expect(readFileSync(DOC, 'utf8')).toBe(expected)
  })
})
