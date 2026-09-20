/**
 * Writing the site to disk — `npm run site`.
 *
 * The same shape as `npm run discoverability`: a plain test run never writes,
 * and an env var turns it into the generator. One mechanism, no extra runner,
 * and the check that the committed output is current comes free.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildSite, reportOf } from './site'
import { publishableLegalPages } from './legalPages'
import { isInside } from './outputPath'

const OUT = join(process.cwd(), 'dist-site')

describe('Emitting the site', () => {
  it('writes every file under the output directory and nowhere else', () => {
    const site = buildSite()

    for (const file of site.files) {
      // The one thing a file-writing generator must never do: escape its own
      // output directory because a path came from data.
      //
      // Asked through `relative()` rather than a string prefix: `resolve()`
      // returns the platform's separator, so comparing against a hard-coded
      // `/` refused every legitimate path on Windows.
      expect(isInside(OUT, file.file), `${file.file} escapes the output root`).toBe(true)
    }

    if (process.env.EMIT_SITE !== '1') return

    /*
     * NOTHING IS WRITTEN WITH A BUSINESS FACT STILL BLANK (§U).
     *
     * Building the site with a token visible is fine and deliberate — the
     * report reads it, and a half-filled page is embarrassing in the way that
     * gets it fixed. PUBLISHING one is a different act: that page is what a
     * store reviewer opens and what a customer uses to exercise a data right,
     * and "write to [[SUPPORT_EMAIL]]" is not a contact.
     *
     * Checked HERE, at the moment of writing to disk, so building and testing
     * the site stay possible while it is unfinished. `dist-site` shipped with
     * three such pages before this line existed.
     */
    publishableLegalPages()

    rmSync(OUT, { recursive: true, force: true })
    for (const file of site.files) {
      const target = resolve(OUT, file.file)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, file.contents, 'utf8')
    }
    console.log(reportOf(site))
  })
})
