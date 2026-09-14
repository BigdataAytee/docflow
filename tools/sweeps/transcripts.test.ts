/**
 * The transcripts a D12 tester listens against (§V, D12).
 *
 * `npm run sweep:screenreader` writes one file per route: the nodes a screen
 * reader walks, in order, with the name each carries. They are committed for
 * two reasons — somebody doing the device pass has a script to compare what
 * they hear against, and a change to what the app SAYS shows up in a diff
 * rather than in somebody's ear six weeks later.
 *
 * This test runs in CI, where there is no browser, so it cannot regenerate
 * them. What it can do is refuse to let a route exist without one.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROUTES } from './responsive.test'

const TRANSCRIPTS = join(process.cwd(), 'docs', 'a11y', 'transcripts')

const nameOf = (route: string): string =>
  `${route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-')}.txt`

describe('Every route has a transcript to listen against', () => {
  it('has one per swept route, and no orphans', () => {
    const expected = ROUTES.map(nameOf).sort()
    const actual = readdirSync(TRANSCRIPTS)
      .filter((file) => file.endsWith('.txt'))
      .sort()

    // A route added without regenerating fails here, which is the only guard
    // CI can offer: it has no browser to regenerate them with.
    expect(actual).toEqual(expected)
  })

  it('says something on every one of them', () => {
    for (const route of ROUTES) {
      const path = join(TRANSCRIPTS, nameOf(route))
      expect(existsSync(path), `${route} has no transcript`).toBe(true)

      const lines = readFileSync(path, 'utf8').trim().split('\n')
      expect(lines.length, `${route} announces almost nothing`).toBeGreaterThan(3)
    }
  })

  it('names a main landmark on every in-app route', () => {
    // The thing the screen-reader sweep fixed, visible in the artefact a
    // person reads rather than only in a passing test.
    for (const route of ROUTES) {
      const text = readFileSync(join(TRANSCRIPTS, nameOf(route)), 'utf8')
      expect(text, `${route} has no main`).toContain('main')
    }
  })

  it('repeats no name straight back at itself', () => {
    // "region: Outstanding" followed by "StaticText: Outstanding" is the app
    // saying the same word twice. The first capture was half noise.
    for (const route of ROUTES) {
      const lines = readFileSync(join(TRANSCRIPTS, nameOf(route)), 'utf8').trim().split('\n')
      for (let at = 1; at < lines.length; at += 1) {
        const previous = lines[at - 1] ?? ''
        const current = lines[at] ?? ''
        if (!current.startsWith('StaticText: ')) continue
        const said = current.slice('StaticText: '.length)
        expect(previous.includes(said), `${route}: "${said}" is announced twice`).toBe(false)
      }
    }
  })
})
