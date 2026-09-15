/**
 * Fields that are declared and then half-wired (§E, §I, §D, §S).
 *
 * WHY THIS EXISTS. In one pass over the waybill, four bugs turned out to be
 * the same bug wearing different clothes — something declared in one layer
 * and never honoured in the layer below:
 *
 *  · `compose` declared a UNIT column; no row ever supplied one, so every
 *    printed delivery had a column of blanks.
 *  · §E and Postgres carried `expected_delivery_date`; no draft held it, so
 *    the date a recipient cares about could not be entered.
 *  · `LineItem.unit` existed; `convertDocument` dropped it, so an invoice
 *    converted to a delivery arrived with no units.
 *  · `Home` accepted `onLogOut`; nothing passed it, so the installed app had
 *    no way to sign out.
 *
 * Every one survived a passing suite, and one survived a test written about
 * it: the UNIT column had a case asserting `columns` CONTAINED a unit key.
 * That is an assertion about a DECLARATION. It stayed true for as long as the
 * column printed blank.
 *
 * SO THIS COMPARES READS AGAINST WRITES, not whether a name appears.
 *
 * The first version of this check asked whether anything outside the
 * declaring file MENTIONED each field — and it would have caught none of the
 * four. `unit` is named in 36 files, `expectedDate` in 6, `onLogOut` in 4.
 * The name was never missing. One half of the pair was:
 *
 *  · READ AND NEVER WRITTEN is a blank column — `DocumentPage` read
 *    `row.unit` and nothing ever put one there.
 *  · WRITTEN AND NEVER READ is dead weight: a value carried through every
 *    layer that no screen and no document ever shows.
 *
 * Both are invisible to the compiler, because an optional property nobody
 * sets and an optional property nobody reads are both perfectly legal. That
 * is exactly why they lasted.
 *
 * WHAT IT CANNOT DO, measured rather than guessed.
 *
 * Mutation-tested against all four original bugs by reintroducing each one:
 * it caught ONE. The other three it misses for a single reason worth naming
 * precisely, because the name is more useful than a partial automation of it.
 *
 * A FIELD ASSIGNED BY A MAPPER READS AS WRITTEN EVEN WHEN NOTHING A USER CAN
 * REACH EVER FILLS IT. `expectedDate` is assigned in `composition.ts` and in
 * the builder's commit, so deleting the step where a person enters one leaves
 * the field looking perfectly filled. `unit` is written by the items step, so
 * `convertDocument` dropping it is invisible here. A pass-through assignment
 * is syntactically identical to a real fill, and this is a text scan.
 *
 * So the shape it catches is DECLARED AND NEVER CONSUMED. The shape it does
 * not catch is DECLARED AND NEVER REACHABLY FILLED — the one that produced
 * `vehicleNumber` and `expectedDate`, both found by eye rather than by any
 * check. Answering that properly means reachability analysis, which is a
 * different and much harder question; a heuristic version would produce false
 * positives, and a guard that cries wolf is a guard people learn to ignore.
 *
 * Smaller limits, for completeness: a write in dead code counts as a write,
 * and the scan sees shapes rather than meaning, so it does not prove a write
 * and a read lie on the same path.
 *
 * It still earns its place. It found `TableRow.photoAssetId` and
 * `PageModel.receiptEvidence` unprompted — a dead field and a printed
 * receipt missing the three facts that make it a receipt — neither of which
 * anybody was looking for.
 */

export interface Declaration {
  /** Where it is declared, for the report. */
  readonly layer: string
  /** The property name as it appears in source. */
  readonly name: string
  /** The file declaring it, for the report. */
  readonly declaredIn: string
  /**
   * Where the field must be FILLED, when a name alone is too coarse.
   *
   * A global scan asks "is this name written anywhere?", and for a name used
   * on more than one shape that is the wrong question: `unit` is written onto
   * a LINE ITEM in the items step, so `TableRow.unit` looked filled while the
   * printed column was blank. Reverting the real fix and re-running proved
   * it — the check stayed green.
   *
   * Naming the LAYER that owns the shape makes the question specific again:
   * not "does anything write a unit" but "does anything in the pdf layer".
   *
   * A path prefix, and it bounds BOTH halves. Scoping only the writes was an
   * asymmetry that produced a wrong label: `TableRow.photoAssetId` is touched
   * by nothing in the pdf layer at all, and got reported as "read but never
   * written" because an EXPENSE's photo is read elsewhere.
   */
  readonly scope?: string
}

export interface HalfWired {
  readonly layer: string
  readonly name: string
  readonly declaredIn: string
  /** Which half is missing — the half that makes it a bug. */
  readonly kind:
    | 'read but never written'
    | 'written but never read'
    | 'declared and never touched'
}

/**
 * Names whose other half is real but invisible to a text scan, each with the
 * reason. Kept SHORT and justified: this list is where a check like this goes
 * to die, one "just this one" at a time.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
  id: 'written by object spread in every repository mapper',
  companyId: 'written by object spread in every repository mapper',
}

const PROPERTY = /^\s{2,}(?:readonly\s+)?([a-zA-Z][a-zA-Z0-9_]*)\??\s*:/

/** Matches a bare type on the right of a colon — a declaration, not a write. */
const TYPE_RHS = '(string|number|boolean|Money|IsoDay|DocumentType|readonly)\\b'

/**
 * The property names an interface block declares.
 *
 * Parsed from source rather than from the type system, because the whole
 * point is to catch what the type system is content with.
 */
export function propertiesOf(source: string, interfaceName: string): string[] {
  const at = source.search(new RegExp(`(?:export\\s+)?interface\\s+${interfaceName}\\b[^{]*\\{`))
  if (at === -1) return []

  const open = source.indexOf('{', at)
  let depth = 0
  let close = open
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) {
        close = index
        break
      }
    }
  }

  const names: string[] = []
  for (const line of source.slice(open + 1, close).split('\n')) {
    // The block's OWN properties only: a nested object's keys are indented
    // further and belong to a shape this is not asking about.
    const match = PROPERTY.exec(line)
    if (match?.[1] !== undefined && line.search(/\S/) <= 3) names.push(match[1])
  }
  return names
}

/**
 * Does this line SET the field, rather than declare its type?
 *
 * `unit: line.unit` sets it; `readonly unit?: string` declares it. Telling
 * those apart by shape is the whole job — it is the difference between a
 * filled column and an empty one.
 */
export function writesOn(line: string, name: string): boolean {
  if (line.includes('readonly ')) return false
  if (!new RegExp(`(?<![.\\w])${name}\\s*:`).test(line)) return false
  return !new RegExp(`${name}\\??\\s*:\\s*${TYPE_RHS}`).test(line)
}

/** Does this line READ it — `row.unit`, or destructured out of an object? */
export function readsOn(line: string, name: string): boolean {
  if (new RegExp(`\\.${name}\\b`).test(line)) return true
  return new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=`).test(line)
}

/**
 * Which declarations are missing one half of the pair.
 *
 * EVERY file is scanned, the declaring one included: the code that fills a
 * shape usually lives beside the shape, and excluding it is what made the
 * first version of this blind to the bug it was written for.
 */
export function halfWired(
  declarations: readonly Declaration[],
  files: ReadonlyMap<string, string>,
): HalfWired[] {
  const found: HalfWired[] = []

  for (const declaration of declarations) {
    if (declaration.name in EXEMPT) continue

    let written = false
    let read = false

    for (const [path, source] of files) {
      /*
       * TESTS ARE NOT THE PRODUCT, and this line is the difference between a
       * check that works and one that looks like it does.
       *
       * With test files counted, the real UNIT bug still passed: a fixture in
       * `compose.test.ts` wrote `unit: 'cartons'`, so the field read as
       * filled while the row builder supplied nothing and the printed column
       * was blank. A test filling a shape proves the shape can be filled, not
       * that anything fills it.
       */
      if (/\.test\.tsx?$/.test(path)) continue

      // A scoped declaration is only honoured inside its own layer. Both
      // halves are bounded, or the label is wrong — see `scope`.
      if (declaration.scope !== undefined && !path.startsWith(declaration.scope)) continue

      for (const line of source.split('\n')) {
        if (!read && readsOn(line, declaration.name)) read = true
        if (!written && writesOn(line, declaration.name)) written = true
        if (written && read) break
      }
      if (written && read) break
    }

    if (!read && !written) found.push({ ...declaration, kind: 'declared and never touched' })
    else if (read && !written) found.push({ ...declaration, kind: 'read but never written' })
    else if (written && !read) found.push({ ...declaration, kind: 'written but never read' })
  }

  return found
}

export function reportOf(found: readonly HalfWired[], checked: number): string {
  if (found.length === 0) {
    return `  ${checked} declared fields, every one both filled and read`
  }
  const lines = [`  ${found.length} of ${checked} declared fields are half-wired:`]
  for (const item of found) {
    lines.push(`    ${item.layer}: ${item.name} — ${item.kind} (${item.declaredIn})`)
  }
  return lines.join('\n')
}
