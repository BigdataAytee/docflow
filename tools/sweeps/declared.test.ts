/**
 * The declared-but-never-honoured sweep, run against this repository.
 *
 * Two halves, like the other sweeps. The RULE is pure and tested against
 * fixtures, so a broken rule cannot pass silently. The SCAN walks the real
 * source, so the rule is actually pointed at something.
 *
 * Unlike the browser sweeps this needs no Chromium, so it runs in `npm test`
 * — which matters, because the four bugs it exists to catch all reached a
 * commit while every check that ran was green.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { type Declaration, halfWired, propertiesOf, readsOn, reportOf, writesOn } from './declared'

const ROOT = process.cwd()

/* ----------------------------------------------------------- the rule */

describe('The rule itself', () => {
  const files = (entries: Record<string, string>) => new Map(Object.entries(entries))

  /**
   * THE FOUR BUGS, as fixtures. Each is the shape the real one had, so this
   * file says what the check is for rather than merely that it runs.
   */
  it('catches a column that is read and never written — the UNIT bug', () => {
    const found = halfWired(
      [{ layer: 'page row', name: 'unit', declaredIn: 'compose.ts' }],
      files({
        // Declared, and the page prints it…
        'compose.ts': '  readonly unit?: string',
        'DocumentPage.tsx': '<td>{row.unit}</td>',
        // …and the row builder never supplies one.
        'rows.ts': 'description: line.description,',
      }),
    )
    expect(found).toEqual([
      { layer: 'page row', name: 'unit', declaredIn: 'compose.ts', kind: 'read but never written' },
    ])
  })

  it('catches a prop that is written and never read — the onLogOut bug', () => {
    const found = halfWired(
      [{ layer: 'props', name: 'onLogOut', declaredIn: 'Home.tsx' }],
      files({
        'Home.tsx': '  readonly onLogOut?: () => void',
        'Screen.tsx': 'onLogOut: () => setSigningOut(true),',
      }),
    )
    expect(found[0]?.kind).toBe('written but never read')
  })

  it('says nothing when both halves are there', () => {
    const found = halfWired(
      [{ layer: 'page row', name: 'unit', declaredIn: 'compose.ts' }],
      files({
        'compose.ts': 'unit: line.unit,',
        'DocumentPage.tsx': '<td>{row.unit}</td>',
      }),
    )
    expect(found).toEqual([])
  })

  /**
   * The near-miss that would make this quietly useless: `unit` must not read
   * as written because `unitPriceMinor` is assigned nearby. That is the exact
   * pair that hid the blank column.
   */
  it('does not mistake a longer name for the shorter one', () => {
    expect(writesOn('unitPriceMinor: line.unitPriceMinor,', 'unit')).toBe(false)
    expect(readsOn('line.unitPriceMinor', 'unit')).toBe(false)
    expect(writesOn('unit: line.unit,', 'unit')).toBe(true)
    expect(readsOn('row.unit', 'unit')).toBe(true)
  })

  /** A declaration is not a write, however many times it is restated. */
  it('never counts a type declaration as filling anything', () => {
    expect(writesOn('  readonly unit?: string', 'unit')).toBe(false)
    expect(writesOn('  unit: string', 'unit')).toBe(false)
    expect(writesOn('  unit?: Money', 'unit')).toBe(false)
  })

  it('reads an interface block for its own properties, not nested ones', () => {
    const source = [
      'export interface DocumentRecord {',
      '  readonly id: string',
      '  readonly unit?: string',
      '  readonly party: {',
      '    readonly name: string',
      '  }',
      '}',
    ].join('\n')

    expect(propertiesOf(source, 'DocumentRecord')).toEqual(['id', 'unit', 'party'])
  })
})

/* ------------------------------------------------------ the real scan */

/** Every TypeScript source file, so a mention anywhere counts. */
function sources(): Map<string, string> {
  const found = new Map<string, string>()

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue
      found.set(relative(ROOT, full).split(sep).join('/'), readFileSync(full, 'utf8'))
    }
  }

  walk(join(ROOT, 'src'))
  walk(join(ROOT, 'supabase', 'functions'))
  return found
}

describe('Nothing is declared and then left unread (§E, §I, §D)', () => {
  it('finds no document field that no layer below ever touches', () => {
    const files = sources()

    /*
     * The layers where the four known bugs were each declared. Every one is a
     * shape something ELSE is supposed to fill or read — a record the store
     * writes, a draft the builder edits, a line the page prints.
     */
    const blocks: readonly {
      layer: string
      file: string
      interfaceName: string
      scope?: string
    }[] = [
      { layer: '§E document', file: 'src/data/repositories/types.ts', interfaceName: 'DocumentRecord' },
      /*
       * Added after `logoAssetId` turned out to be the fifth instance of the
       * species: on this shape in both schemas, read by Home's setup
       * checklist and by the page composer, and writable by nothing — so the
       * checklist carried a step that could never be ticked and every
       * document printed an empty white square.
       *
       * AND THIS SWEEP WOULD NOT HAVE CAUGHT IT. Measured, not assumed:
       * deleting the write that fixes it leaves the scan green, because
       * `logoAssetId: text(row['logo_asset_id'])` in the Supabase mapper
       * reads as a write. That is the reachability limit the header names,
       * and it is worth having the shape scanned anyway — the fields that
       * nothing maps are still covered.
       */
      { layer: '§E company', file: 'src/data/repositories/types.ts', interfaceName: 'Company' },
      { layer: '§E line', file: 'src/domain/documents/types.ts', interfaceName: 'LineItem' },
      // SCOPED: a draft is edited by the builder's own steps, and names like
      // `unit` and `dispatchDate` belong to other shapes elsewhere.
      {
        layer: 'draft',
        file: 'src/features/documents/builder.ts',
        interfaceName: 'DocumentDraft',
        scope: 'src/features/documents/',
      },
      // SCOPED to the pdf layer, because `unit` is a name two shapes share —
      // a line item has one too. Unscoped, the items step writing a unit made
      // the printed column look filled while it printed blanks. Proved by
      // reverting the real fix: the check stayed green.
      {
        layer: 'page row',
        file: 'src/pdf/compose.ts',
        interfaceName: 'TableRow',
        scope: 'src/pdf/',
      },
      { layer: 'page model', file: 'src/pdf/compose.ts', interfaceName: 'PageModel' },
      /*
       * THE NESTED SHAPES, added because the sweep walked PageModel's own
       * properties and stopped there — so `paymentBox` counted as read the
       * moment the page read its heading, and `otherMethods` inside it was
       * neither supplied by any caller nor drawn by any page. §I asks for
       * 'online methods under a dashed divider'; an owner could switch a
       * method on in Settings and it printed nowhere.
       *
       * Scoped to the pdf layer: `rows` and `heading` are names half the
       * repository uses.
       */
      {
        layer: 'payment box',
        file: 'src/pdf/compose.ts',
        interfaceName: 'PaymentBox',
        scope: 'src/pdf/',
      },
      {
        layer: 'receipt evidence',
        file: 'src/pdf/compose.ts',
        interfaceName: 'ReceiptEvidence',
        scope: 'src/pdf/',
      },
      { layer: 'public view', file: 'supabase/functions/public-link/rules.ts', interfaceName: 'PublicView' },
    ]

    const declarations: Declaration[] = []
    for (const block of blocks) {
      const source = files.get(block.file)
      expect(source, `${block.file} is not being scanned`).toBeDefined()
      const names = propertiesOf(source!, block.interfaceName)
      expect(
        names.length,
        `${block.interfaceName} parsed as empty — the scan would pass by finding nothing`,
      ).toBeGreaterThan(0)

      for (const name of names) {
        declarations.push({
          layer: block.layer,
          name,
          declaredIn: block.file,
          ...(block.scope === undefined ? {} : { scope: block.scope }),
        })
      }
    }

    const found = halfWired(declarations, files)
    console.log(reportOf(found, declarations.length))
    expect(found, reportOf(found, declarations.length)).toEqual([])
  })
})
