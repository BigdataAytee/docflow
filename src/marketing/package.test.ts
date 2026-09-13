/**
 * §T's unit of launch: "a locale is not 'launched' without its discoverability
 * package."
 *
 * The point of these tests is that the answer is currently NO for every locale
 * and stays that way until somebody does the work — not that the report is
 * pretty.
 */

import { describe, expect, it } from 'vitest'

import { LAUNCH_LOCALES, TERMINOLOGY_TABLES } from '../domain/locale/data/terminology'
import { LOCALE_LISTING_INPUTS } from './keywords'
import { packageFor, packageReport, reportOf } from './package'

describe('A locale is not launched without its package (§T)', () => {
  it('reports every launch locale blocked today, and says why', () => {
    const report = packageReport()

    expect(report.packages).toHaveLength(LAUNCH_LOCALES.length)
    expect(report.launchable).toEqual([])
    expect(report.blocked).toEqual([...LAUNCH_LOCALES])

    for (const entry of report.packages) {
      expect(
        entry.blockers.some((b) => b.includes('not approved')),
        `${entry.locale} is blocked for some reason other than its review status`,
      ).toBe(true)
    }
  })

  it('says "cannot launch", not a count of what is done', () => {
    const text = reportOf(packageReport())

    expect(text).toContain('cannot launch')
    expect(text).not.toMatch(/ready to submit/)
    // Every locale names its own blocker, so the report is actionable rather
    // than a summary line somebody has to go and investigate.
    for (const locale of LAUNCH_LOCALES) expect(text).toContain(locale)
  })

  it('calls a missing locale a hole in the launch set, not an empty package', () => {
    const missing = packageFor('PT-BR')

    expect(missing.launchable).toBe(false)
    expect(missing.blockers.join(' ')).toContain('terminology table')
    expect(missing.listing.title).toBe('')
  })
})

describe('Rule 4 reaches the store listing too', () => {
  it('has no document type label anywhere in the listing inputs', () => {
    // The four types come from the §D synonyms at generation time. A label
    // typed into this file would be a second source of truth for the one word
    // CLAUDE.md says has exactly one — and it would go stale silently, in the
    // one place a user reads before installing.
    //
    // Asserted against the VALUES rather than the source text: quoting §T's
    // own examples in a comment is how the reasoning survives, and a comment
    // ships to nobody.
    //
    // Matched as WHOLE WORDS, and only against the locale's own labels. The
    // French qualifier "facturation" contains the Spanish label "Factura" as a
    // substring and is a perfectly good French word; a substring check would
    // fail it and teach the next person to weaken the test.
    const wordsOf = (value: string): string[] =>
      value
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 0)

    const containsPhrase = (haystack: string[], needle: string[]): boolean =>
      needle.length > 0 &&
      haystack.some((_, i) => needle.every((word, j) => haystack[i + j] === word))

    for (const locale of LAUNCH_LOCALES) {
      const table = TERMINOLOGY_TABLES[locale]
      const input = LOCALE_LISTING_INPUTS[locale]
      if (table === undefined || input === undefined) continue

      const values = [
        ...input.intents,
        ...input.qualifiers,
        input.titleIntent ?? '',
        input.titleOverride ?? '',
        input.subtitleOverride ?? '',
      ]

      for (const type of Object.values(table.types)) {
        for (const label of [type.label, type.pluralLabel, type.printedTitle]) {
          for (const value of values) {
            expect(
              containsPhrase(wordsOf(value), wordsOf(label)),
              `"${label}" (${locale}) is hardcoded in the "${value}" listing input`,
            ).toBe(false)
          }
        }
      }
    }
  })
})
