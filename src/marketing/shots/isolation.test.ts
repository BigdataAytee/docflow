/**
 * The screenshot build reaches nobody.
 *
 * The fixtures are demo records with plausible customer names and amounts —
 * fine in a store screenshot, wrong in an installed app, where they would be
 * indistinguishable from somebody's own work. The arrangement that keeps them
 * out is a separate Vite entry and a separate output directory, and "it is
 * only in the screenshot build" is exactly the kind of claim that rots the
 * first time somebody adds an import.
 *
 * So it is asserted against the built artefact rather than against the
 * arrangement.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { shotState } from './fixtures'

const DIST = resolve(process.cwd(), 'dist', 'assets')

/** Names a reader would recognise as belonging to a screenshot, not an app. */
const FIXTURE_MARKERS = [
  'Northgate Joinery',
  'Hartley & Co',
  'Al Noor Trading',
  'Talleres Herrera',
  'co_shots',
]

describe('The screenshot fixtures are not in the app people install', () => {
  it('names markers that really are in the fixtures', () => {
    // A scan for strings that are not there passes for the wrong reason, and
    // keeps passing after somebody renames the fixtures.
    const text = JSON.stringify(shotState('GB')) + JSON.stringify(shotState('AE'))

    for (const marker of ['Northgate Joinery', 'Hartley & Co', 'Al Noor Trading', 'co_shots']) {
      expect(text, `${marker} is not actually a fixture string`).toContain(marker)
    }
  })

  it('finds none of them in dist/assets', () => {
    /*
     * FAILS without a build rather than returning quietly.
     *
     * The comment here used to read "`npm test` runs before `npm run build`
     * in CI", which is backwards — ci.yml puts Build first precisely so this
     * check has something to read, and says so. So the early return was
     * skipping on the strength of a condition that had stopped being true,
     * and this assertion was silently doing nothing.
     */
    expect(existsSync(DIST), 'No build to scan — run `npm run build` first.').toBe(true)

    for (const file of readdirSync(DIST).filter((name) => name.endsWith('.js'))) {
      const contents = readFileSync(join(DIST, file), 'utf8')
      for (const marker of FIXTURE_MARKERS) {
        expect(contents.includes(marker), `${file} ships the screenshot fixture ${marker}`).toBe(
          false,
        )
      }
    }
  })

  it('is not imported by the app entry point, directly or otherwise', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')

    expect(main).not.toContain('marketing/shots')
    expect(main).not.toContain('fixtures')
  })
})
