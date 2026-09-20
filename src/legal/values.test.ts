/**
 * Where the business facts go, and what happens until they get there (§U).
 *
 * `placeholders.ts` declared the eight facts nobody here may invent and
 * `documents.ts` wrote `[[TOKEN]]` wherever one belonged — and there was no
 * place at all to put the answers. So `dist-site/legal/privacy/index.html`
 * shipped a page reading "write to [[SUPPORT_EMAIL]]": a data-rights contact
 * that is not an address, on the page a store reviewer opens.
 *
 * Two properties, and the second is the one that matters. A half-filled page
 * is allowed to EXIST — visible tokens are what gets them filled — but it is
 * not allowed to be PUBLISHED.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PLACEHOLDERS, unfilled } from './placeholders'
import {
  LegalValuesError,
  VALUES_FILE,
  legalValues,
  missingValues,
  valuesTemplate,
} from './values'
import {
  UnfilledLegalPageError,
  legalPages,
  publishableLegalPages,
} from '../marketing/legalPages'

/** A throwaway project root holding the file at the path the module reads. */
const withFile = (contents: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'docflow-legal-'))
  mkdirSync(join(dir, 'legal'), { recursive: true })
  writeFileSync(join(dir, VALUES_FILE), contents, 'utf8')
  return dir
}

describe('The answers have somewhere to live', () => {
  it('reads what a person wrote', () => {
    const dir = withFile('{ "SUPPORT_EMAIL": "help@example.test" }')
    expect(legalValues(dir)).toEqual({ SUPPORT_EMAIL: 'help@example.test' })
  })

  /** Absent is the normal state until somebody fills it, not an error. */
  it('is content with no file at all', () => {
    expect(legalValues(mkdtempSync(join(tmpdir(), 'docflow-empty-')))).toEqual({})
  })

  /**
   * A TYPO IS AN ERROR, not something to skip. `SUPPORT_EMAL` ignored would
   * leave the real token unfilled while the file looked complete — which is
   * the failure this whole module exists to prevent, reintroduced by kindness.
   */
  it('refuses a token no document uses', () => {
    const dir = withFile('{ "SUPPORT_EMAL": "help@example.test" }')
    expect(() => legalValues(dir)).toThrow(LegalValuesError)
  })

  it('refuses a blank answer', () => {
    expect(() => legalValues(withFile('{ "SUPPORT_EMAIL": "  " }'))).toThrow(LegalValuesError)
  })

  /**
   * And a malformed file THROWS rather than reading as "nobody has filled
   * these in" — which would publish a policy full of tokens while somebody
   * believed they had answered.
   */
  it('refuses to read a broken file as an empty one', () => {
    expect(() => legalValues(withFile('{ oops'))).toThrow(LegalValuesError)
    expect(() => legalValues(withFile('["SUPPORT_EMAIL"]'))).toThrow(LegalValuesError)
  })

  it('names what is still missing, so a person is told rather than discovers', () => {
    const missing = missingValues({ SUPPORT_EMAIL: 'help@example.test' })
    expect(missing.map((placeholder) => placeholder.token)).not.toContain('SUPPORT_EMAIL')
    expect(missing).toHaveLength(PLACEHOLDERS.length - 1)
    for (const placeholder of missing) expect(placeholder.what.length).toBeGreaterThan(10)
  })

  /** The example is written from the declarations, so it cannot go stale. */
  it('offers a template covering every declared fact', () => {
    const template = JSON.parse(valuesTemplate()) as Record<string, string>
    expect(Object.keys(template).sort()).toEqual(
      PLACEHOLDERS.map((placeholder) => placeholder.token).sort(),
    )
  })

  /**
   * AND THE EXAMPLE IN THE REPOSITORY IS THAT TEMPLATE.
   *
   * Checked in so somebody can copy it to `legal/values.json` and fill it,
   * and generated so a ninth fact added tomorrow cannot leave the example
   * short by one. `npm run legal` rewrites it.
   */
  it('keeps the checked-in example in step', () => {
    const path = join(process.cwd(), 'legal/values.example.json')
    if (process.env['UPDATE_LEGAL'] === '1') {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, valuesTemplate(), 'utf8')
      return
    }
    expect(existsSync(path), 'run `npm run legal` to write it').toBe(true)
    expect(readFileSync(path, 'utf8')).toBe(valuesTemplate())
  })
})

describe('A blank may exist, but may never be published (§U)', () => {
  /**
   * Visible on purpose. A page showing `[[SUPPORT_EMAIL]]` is embarrassing in
   * exactly the way that gets it fixed; one that silently dropped the line
   * would look finished with a legal requirement missing.
   */
  it('leaves an unanswered fact on the page it builds', () => {
    const pages = legalPages({})
    expect(pages.flatMap((page) => unfilled(page.contents))).toContain('SUPPORT_EMAIL')
  })

  /** And fills the ones that were answered, on the real rendered page. */
  it('fills what it was given', () => {
    const pages = legalPages({ SUPPORT_EMAIL: 'help@example.test' })
    const privacy = pages.find((page) => page.path.includes('privacy'))?.contents ?? ''
    expect(privacy).toContain('help@example.test')
    expect(unfilled(privacy)).not.toContain('SUPPORT_EMAIL')
  })

  /**
   * THE ONE THIS IS FOR. Publishing is a different act from building: that
   * page is what a store reviewer opens and what a customer uses to exercise
   * a data right, and "write to [[SUPPORT_EMAIL]]" is not a contact.
   */
  it('refuses to publish a page with a fact still blank', () => {
    expect(() => publishableLegalPages({})).toThrow(UnfilledLegalPageError)
  })

  /** And says which, and where the answers go — not just that it refused. */
  it('names every blank and the file they belong in', () => {
    try {
      publishableLegalPages({})
      expect.unreachable()
    } catch (cause) {
      const message = (cause as Error).message
      expect(message).toContain('SUPPORT_EMAIL')
      expect(message).toContain('/legal/privacy')
      expect(message).toContain('legal/values.json')
    }
  })

  /** Answered in full, it publishes. */
  it('publishes once every fact is answered', () => {
    const answered = Object.fromEntries(
      PLACEHOLDERS.map((placeholder) => [placeholder.token, `answer for ${placeholder.token}`]),
    )
    const pages = publishableLegalPages(answered)
    expect(pages.length).toBeGreaterThan(0)
    expect(pages.flatMap((page) => unfilled(page.contents))).toEqual([])
  })
})
