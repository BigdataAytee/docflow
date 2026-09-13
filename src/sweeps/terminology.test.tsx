/**
 * The terminology sweep (§Q Phase 7: "terminology — every launch locale walked
 * through every screen and PDF").
 *
 * Rule #4 is enforced at the source by the lint rule: no hardcoded type name
 * in UI or PDF code. That stops a label being TYPED. It does not stop a screen
 * resolving the wrong one — reading the invoice label on a waybill screen, or
 * resolving against a default profile instead of the company's — and a lint
 * rule never will, because both are correct-looking calls.
 *
 * So this walks the screens and asserts what a person walking them would: the
 * locale's own word appears, and another locale's word for the same type does
 * not.
 *
 * **Four locales, not seven.** FR, ES and AR have no UI strings (§S,
 * `strings.ts`), so there is no French app to walk. That is the same gap that
 * stops their landing pages and their screenshots, reported the same way
 * rather than skipped quietly.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CompanyProvider } from '../app/context'
import { createMemoryRepositories, emptyState } from '../data/repositories'
import { DOCUMENT_TYPES } from '../domain/documents/types'
import { hasStringsFor } from '../domain/locale/data/strings'
import { LAUNCH_LOCALES, TERMINOLOGY_TABLES } from '../domain/locale/data/terminology'
import { DocumentList } from '../features/documents/DocumentList'

/** The locales there is an app to walk, and the ones there is not. */
const WALKABLE = LAUNCH_LOCALES.filter((locale) => {
  const table = TERMINOLOGY_TABLES[locale]
  return table !== undefined && hasStringsFor(table.language)
})
const UNWALKABLE = LAUNCH_LOCALES.filter((locale) => !WALKABLE.includes(locale))

function walk(locale: string, node: React.ReactNode) {
  const table = TERMINOLOGY_TABLES[locale]
  if (table === undefined) throw new Error(`no table for ${locale}`)
  return render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale }}
      language={table.language}
    >
      {node}
    </CompanyProvider>,
  )
}

describe('Every walkable locale says its own word (§D, Rule #4)', () => {
  it('shows the locale’s label on each type’s list', () => {
    for (const locale of WALKABLE) {
      const table = TERMINOLOGY_TABLES[locale]
      if (table === undefined) continue

      for (const type of DOCUMENT_TYPES) {
        const view = walk(locale, <DocumentList type={type} rows={[]} onOpen={() => undefined} onNew={() => undefined} />)
        const term = table.types[type]

        expect(
          screen.queryAllByText(new RegExp(term.label, 'i')).length,
          `${locale}/${type} never says "${term.label}"`,
        ).toBeGreaterThan(0)
        view.unmount()
      }
    }
  })

  it('never shows another locale’s word for the same type', () => {
    // The failure a lint rule cannot see: a correct-looking resolve against
    // the wrong profile. EN-NG and EN-GB disagree about the delivery document
    // and agree about everything else, which makes that pair the test.
    const ng = TERMINOLOGY_TABLES['EN-NG']
    const gb = TERMINOLOGY_TABLES['EN-GB']
    if (ng === undefined || gb === undefined) throw new Error('missing tables')
    expect(ng.types.waybill.label).not.toBe(gb.types.waybill.label)

    const view = walk('EN-NG', <DocumentList type="waybill" rows={[]} onOpen={() => undefined} onNew={() => undefined} />)

    expect(screen.queryAllByText(new RegExp(ng.types.waybill.label, 'i')).length).toBeGreaterThan(0)
    expect(
      screen.queryByText(new RegExp(gb.types.waybill.label, 'i')),
      'a Lagos screen said the British word',
    ).toBeNull()
    view.unmount()
  })

  it('walks all four English locales, and says why not the other three', () => {
    expect(WALKABLE).toEqual(['EN-NG', 'EN-GH', 'EN-GB', 'EN-US'])
    // Recorded rather than skipped: there is no French app to walk, which is
    // the same blocker as the French landing page and the French screenshots.
    expect(UNWALKABLE).toEqual(['FR', 'ES', 'AR'])
    for (const locale of UNWALKABLE) {
      const table = TERMINOLOGY_TABLES[locale]
      expect(table).toBeDefined()
      expect(hasStringsFor(table?.language ?? ''), `${locale} gained UI strings`).toBe(false)
    }
  })
})
