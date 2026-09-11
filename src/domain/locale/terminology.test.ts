/**
 * Terminology table tests. The tables are Phase-0 DRAFTS (§Q); these guard the
 * structural promises that no amount of native-speaker review will supply.
 */

import { describe, expect, it } from 'vitest'

import { DOCUMENT_TYPES } from '../documents/types'
import { isReleasable } from './types'
import { LAUNCH_LOCALES, TERMINOLOGY_TABLES } from './data/terminology'

const tables = Object.values(TERMINOLOGY_TABLES)

describe('Every launch locale has a complete table (§D, §Q)', () => {
  it('covers the whole Phase-0 launch set', () => {
    for (const locale of LAUNCH_LOCALES) {
      expect(TERMINOLOGY_TABLES[locale]).toBeDefined()
    }
  })

  it('names all four types on every surface', () => {
    for (const table of tables) {
      for (const type of DOCUMENT_TYPES) {
        const t = table.types[type]
        for (const [field, value] of Object.entries(t)) {
          if (field === 'steps') continue
          expect(String(value).trim(), `${table.locale}.${type}.${field}`).not.toBe('')
        }
        expect(t.steps, `${table.locale}.${type}.steps`).toHaveLength(5)
        for (const step of t.steps) expect(step.trim()).not.toBe('')
      }
      for (const [field, value] of Object.entries(table.shared)) {
        expect(String(value).trim(), `${table.locale}.shared.${field}`).not.toBe('')
      }
    }
  })

  it('accepts the local vocabulary as synonyms for each internal type (§D.5, §N)', () => {
    for (const table of tables) {
      for (const type of DOCUMENT_TYPES) {
        const synonyms = table.synonyms[type].map((s) => s.toLocaleLowerCase())
        expect(synonyms.length, `${table.locale}.${type}`).toBeGreaterThan(0)
        // The label a user sees must itself be recognised by the extractors.
        expect(synonyms).toContain(table.types[type].label.toLocaleLowerCase())
      }
    }
  })

  it('never maps one word to two types within a locale', () => {
    for (const table of tables) {
      const seen = new Map<string, string>()
      for (const type of DOCUMENT_TYPES) {
        for (const synonym of table.synonyms[type]) {
          const key = synonym.toLocaleLowerCase()
          expect(seen.get(key), `"${synonym}" in ${table.locale}`).toBeUndefined()
          seen.set(key, type)
        }
      }
    }
  })
})

describe('Machine translation is a draft, never a release (§D)', () => {
  it('holds every Phase-0 table back until a native speaker signs it off', () => {
    // This test flips locale by locale as docs/locale/native-speaker-review.md
    // is signed off. It exists so an unreviewed table cannot ship by accident.
    for (const table of tables) {
      if (isReleasable(table)) {
        expect(table.reviewedBy, `${table.locale} is approved but unattributed`).toBeTruthy()
      } else {
        expect(table.reviewStatus).toMatch(/^(draft|in_review)$/)
      }
    }
  })
})

describe('Label-length resilience (§F)', () => {
  it('exposes the longest shipped label, so layouts can be tested against it', () => {
    const longest = tables
      .flatMap((t) => DOCUMENT_TYPES.map((type) => t.types[type].label))
      .reduce((a, b) => (b.length > a.length ? b : a))

    // §F names "Bon de livraison" and "Guía de remisión" as the stress cases.
    expect(longest.length).toBeGreaterThanOrEqual('Bon de livraison'.length)
  })

  it('keeps Arabic right-to-left (§S)', () => {
    expect(TERMINOLOGY_TABLES.AR?.direction).toBe('rtl')
    for (const table of tables) {
      if (table.locale !== 'AR') expect(table.direction).toBe('ltr')
    }
  })
})

describe('Colour and type identity never follow the label (§F)', () => {
  it('keeps a delivery document typed waybill under every regional name', () => {
    const deliveryLabels = tables.map((t) => t.types.waybill.label)
    expect(new Set(deliveryLabels).size).toBeGreaterThan(1)
    // Same internal type behind all of them.
    for (const table of tables) expect(table.types.waybill.steps).toHaveLength(5)
  })
})
