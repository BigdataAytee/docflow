/**
 * The committed keyword sheet must be what the generator produces.
 *
 * §T asks for the sheets to be "updated in the same cycle as terminology-table
 * changes". This is that promise, enforced: change a label and forget to
 * regenerate, and this test fails with the diff rather than the store listing
 * shipping a word the app no longer uses.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { renderSheet } from './sheet'

const SHEET = join(process.cwd(), 'docs/discoverability/generated.md')

describe('The generated sheet is in the repo and current (§T)', () => {
  it('matches what the terminology tables produce today', () => {
    const rendered = renderSheet()

    // `npm run discoverability` sets this; a plain test run never writes.
    if (process.env.UPDATE_DISCOVERABILITY === '1') {
      mkdirSync(dirname(SHEET), { recursive: true })
      writeFileSync(SHEET, rendered, 'utf8')
    }

    expect(existsSync(SHEET), `${SHEET} is missing — run: npm run discoverability`).toBe(true)
    expect(
      readFileSync(SHEET, 'utf8'),
      'the committed sheet is stale — run: npm run discoverability',
    ).toBe(rendered)
  })

  it('says BLOCKED rather than presenting a listing as ready', () => {
    const rendered = renderSheet()

    expect(rendered).toContain('BLOCKED')
    expect(rendered).not.toContain('ready to submit')
    expect(rendered).toContain('GENERATED FILE — do not edit by hand')
  })
})
