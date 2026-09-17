/**
 * The §Q Phase 1 gate clause:
 *
 *   "label resolution passes its own property test (every UI/PDF/share surface
 *    resolves through one lookup; no hardcoded type-name string survives a
 *    lint rule written for it)"
 *
 * Both halves are asserted here. The second half runs ESLint over the
 * presentation directories in-process, so the gate is a test, not just a CI
 * step — and it fails the moment a literal type name is written anywhere a
 * user could read it.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { ESLint } from 'eslint'

import { DOCUMENT_TYPES } from '../documents/types'
import { LAUNCH_LOCALES } from './data/terminology'
import type { TypeTerminology } from './types'
import {
  type LocaleProfile,
  LocaleError,
  displayLabels,
  freezeLabels,
  label,
  numberingPrefix,
  partyLabel,
  pluralLabel,
  printedTitle,
  resolve,
  searchTerms,
  signatureCaption,
  steps,
} from './profile'

const arbLocale = fc.constantFrom(...LAUNCH_LOCALES)
const arbType = fc.constantFrom(...DOCUMENT_TYPES)
const profile = (locale: string): LocaleProfile => ({ locale })

/** Every surface that carries a type name, as a single list. */
const SURFACES = [
  ['tile / list / builder / share', label],
  ['count line', pluralLabel],
  ['PDF heading', printedTitle],
  ['party label', partyLabel],
  ['signature caption', signatureCaption],
  ['numbering prefix', numberingPrefix],
] as const

/** Which table field each surface is a view of. */
const FIELD_OF: Record<(typeof SURFACES)[number][0], keyof TypeTerminology> = {
  'tile / list / builder / share': 'label',
  'count line': 'pluralLabel',
  'PDF heading': 'printedTitle',
  'party label': 'partyLabel',
  'signature caption': 'signatureCaption',
  'numbering prefix': 'numberingPrefix',
}

describe('Every surface resolves through one lookup (Rule #5, §D.1)', () => {
  it('reads each surface from the same table entry, for every locale and type', () => {
    fc.assert(
      fc.property(arbLocale, arbType, (locale, type) => {
        const p = profile(locale)
        const entry = resolve(p, type)

        // Each named surface is a view of `resolve` — never its own string.
        expect(label(p, type)).toBe(entry.label)
        expect(pluralLabel(p, type)).toBe(entry.pluralLabel)
        expect(printedTitle(p, type)).toBe(entry.printedTitle)
        expect(partyLabel(p, type)).toBe(entry.partyLabel)
        expect(signatureCaption(p, type)).toBe(entry.signatureCaption)
        expect(steps(p, type)).toEqual(entry.steps)
        expect(numberingPrefix(p, type)).toBe(entry.numberingPrefix)
      }),
    )
  })

  it('is deterministic — the same profile always yields the same words', () => {
    fc.assert(
      fc.property(arbLocale, arbType, (locale, type) => {
        for (const [, surface] of SURFACES) {
          expect(surface(profile(locale), type)).toBe(surface(profile(locale), type))
        }
      }),
    )
  })

  it('leaves no surface lagging when the region changes (§V)', () => {
    // The property that matters: every surface is read live from the active
    // table, so switching region moves them together. A surface that cached a
    // word, or read a different table, would show up here as a mismatch.
    fc.assert(
      fc.property(arbLocale, arbLocale, arbType, (from, to, type) => {
        for (const [name, surface] of SURFACES) {
          const source = FIELD_OF[name]
          expect(surface(profile(from), type), `${name} lagged in ${from}`).toBe(
            resolve(profile(from), type)[source],
          )
          expect(surface(profile(to), type), `${name} lagged in ${to}`).toBe(
            resolve(profile(to), type)[source],
          )
        }
      }),
    )
  })

  it('moves every delivery-document surface together, NG -> GB', () => {
    const ng = profile('EN-NG')
    const gb = profile('EN-GB')
    expect(SURFACES.map(([, s]) => s(ng, 'waybill'))).toEqual([
      'Waybill', 'Waybills', 'WAYBILL', 'Deliver to', 'DISPATCHED BY', 'WAY',
    ])
    expect(SURFACES.map(([, s]) => s(gb, 'waybill'))).toEqual([
      'Delivery note', 'Delivery notes', 'DELIVERY NOTE', 'Deliver to', 'DISPATCHED BY', 'DN',
    ])
  })

  /**
   * THE LOCALE IS THE ONLY THING THAT DECIDES A WORD.
   *
   * There used to be a `labelOverrides` on the profile — four boxes in
   * Settings for the owner to type their own name for each type — and it is
   * gone at their instruction: the app works the word out from the country,
   * and asking somebody to type "Waybill" into a field labelled Waybill was
   * the app handing back its own job.
   *
   * This asserts the shape cannot come back by accident: two profiles on the
   * same locale resolve identically, whatever else is attached to them.
   */
  it('resolves from the locale alone, with nothing able to override it', () => {
    const plain: LocaleProfile = { locale: 'EN-GB' }
    const decorated = { locale: 'EN-GB', labelOverrides: { waybill: 'Dispatch docket' } }

    expect(label(decorated as LocaleProfile, 'waybill')).toBe('Delivery note')
    expect(printedTitle(decorated as LocaleProfile, 'waybill')).toBe('DELIVERY NOTE')
    for (const type of ['invoice', 'quotation', 'receipt', 'waybill'] as const) {
      expect(label(decorated as LocaleProfile, type)).toBe(label(plain, type))
    }
  })

  it('refuses an unknown locale rather than falling back silently', () => {
    expect(() => label(profile('XX-ZZ'), 'invoice')).toThrow(LocaleError)
  })
})

describe('Issued documents freeze their labels (§D.2, §M, §V)', () => {
  it('keeps a frozen snapshot through any later region change', () => {
    fc.assert(
      fc.property(arbLocale, arbLocale, arbType, (issuedIn, movedTo, type) => {
        const frozen = freezeLabels(profile(issuedIn), type)
        // The company later switches region — the issued document does not move.
        const shown = displayLabels(profile(movedTo), type, frozen)
        expect(shown).toEqual(frozen)
      }),
    )
  })

  it('lets a draft follow the live profile', () => {
    fc.assert(
      fc.property(arbLocale, arbType, (locale, type) => {
        const shown = displayLabels(profile(locale), type, null)
        expect(shown.printedTitle).toBe(printedTitle(profile(locale), type))
      }),
    )
  })

  it('freezes the language alongside the words', () => {
    expect(freezeLabels(profile('FR'), 'waybill')).toEqual({
      printedTitle: 'BON DE LIVRAISON',
      partyLabel: 'Livrer à',
      signatureCaption: 'EXPÉDIÉ PAR',
      language: 'fr',
    })
  })
})

describe('Search matches both names (§D.3, §V)', () => {
  it('finds a document by its old and its new name alike', () => {
    const frozen = freezeLabels(profile('EN-NG'), 'waybill') // WAYBILL
    // The company moves to the UK and the label becomes "Delivery note".
    const terms = searchTerms(profile('EN-GB'), 'waybill', frozen)

    expect(terms).toContain('waybill') // the frozen title, and the internal type
    expect(terms).toContain('delivery note') // the current label
    expect(terms).toContain('packing slip') // a synonym the extractors accept
  })

  it('always carries the internal type, in every locale', () => {
    fc.assert(
      fc.property(arbLocale, arbType, (locale, type) => {
        expect(searchTerms(profile(locale), type, null)).toContain(type)
      }),
    )
  })
})

describe('No hardcoded type name survives the lint rule (§Q Phase 1 gate)', () => {
  it('finds zero hardcoded type names in UI, PDF and share code', async () => {
    // src/features and src/pdf arrive in Phase 2; the rule is already wired for
    // them, so this scans whatever exists rather than failing on an empty dir.
    const eslint = new ESLint({ cwd: process.cwd(), errorOnUnmatchedPattern: false })
    const results = await eslint.lintFiles(['src/features', 'src/pdf', 'src/app'])
    expect(results.length, 'nothing was scanned — the gate would pass vacuously')
      .toBeGreaterThan(0)

    const violations = results.flatMap((r) =>
      r.messages
        .filter((m) => m.ruleId === 'docflow/no-hardcoded-type-name')
        .map((m) => `${r.filePath.replace(process.cwd() + '/', '')}:${m.line} ${m.message}`),
    )

    expect(violations).toEqual([])
    /*
     * Three minutes, for a test whose own work takes about seven seconds.
     *
     * This is a whole ESLint run over three directories, and it competes for
     * CPU with every other worker in the suite. It timed out at 60s once the
     * suite grew past 2,400 tests, and measured on its own immediately
     * afterwards it took 6.9s — so the bound was measuring machine
     * contention, not this code. A lint gate that goes red because the
     * laptop was busy is one people learn to re-run rather than read.
     */
  }, 180_000)

  it('tells display text from internal tokens and identifiers', async () => {
    // The rule has been refined twice against real code; these pin what it
    // must and must not flag, so a third refinement cannot quietly widen the
    // hole. Internal discriminants (§D: type is always "waybill" in the
    // database) and identifiers are code; anything a user could read is not.
    const eslint = new ESLint({ cwd: process.cwd() })
    const lint = async (source: string): Promise<boolean> => {
      const [result] = await eslint.lintText(source, { filePath: 'src/features/__probe.tsx' })
      return (result?.messages ?? []).some((m) => m.ruleId === 'docflow/no-hardcoded-type-name')
    }

    // Display text — must be reported.
    expect(await lint('export const a = <div>New Invoice</div>')).toBe(true)
    expect(await lint('export const a = <span>invoice</span>')).toBe(true)
    expect(await lint('export const a = `Create a Waybill`')).toBe(true)
    expect(await lint("export const a = 'Delivery note'")).toBe(true)

    // Code — must not be.
    expect(await lint("export const a: string = 'invoice'")).toBe(false)
    expect(await lint("export const a = 'invoice-list'")).toBe(false)
    expect(await lint("export const a = 'invoice_title'")).toBe(false)
    expect(await lint("export const a = 'file-invoice'")).toBe(false)
  }, 60_000)

  it('still bites — a literal type name is reported', async () => {
    // Guards the guard: if the rule silently stopped matching, the assertion
    // above would pass vacuously and the gate would mean nothing.
    const eslint = new ESLint({ cwd: process.cwd() })
    const [result] = await eslint.lintText('export const x = <div>New Invoice</div>', {
      filePath: 'src/features/__probe.tsx',
    })

    const ids = (result?.messages ?? []).map((m) => m.ruleId)
    expect(ids).toContain('docflow/no-hardcoded-type-name')
  }, 60_000)
})
