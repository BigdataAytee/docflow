/**
 * The status board's numbers, checked against the repository (§X).
 *
 * PLAN.md opens with a board, and the board makes counted claims: how many
 * migrations exist, how many edge functions, how many tests stand behind each
 * Phase-1 gate clause. Every one of them was true when it was written and
 * none of them stays true on its own — the migration count was a word behind
 * within a day of the nineteenth migration landing, and "113 tests" had
 * drifted so far it matched nothing that could be pointed at.
 *
 * A number nobody can re-run is a claim on trust, which §X says this file
 * does not get to make. So the board names the path beside each count, and
 * this test re-derives the count from that path. It fails on the commit that
 * makes the board stale rather than months later, when somebody notices.
 *
 * It counts `it(` rather than running the suites: the suites already run in
 * CI, and a test that re-runs them to count them would double the slowest
 * part of the build to check a sentence. The two agree exactly today, and if
 * a dynamic `it.each` ever makes them disagree, the fix is to say so in the
 * board rather than to loosen this.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = (...parts: string[]): string => resolve(process.cwd(), ...parts)
const PLAN = readFileSync(root('PLAN.md'), 'utf8')

/** The board writes small numbers as words, the way the prose around it does. */
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, 'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23,
  'twenty-four': 24, 'twenty-five': 25, 'twenty-six': 26, 'twenty-seven': 27,
  'twenty-eight': 28, 'twenty-nine': 29, thirty: 30,
}

/** The board capitalises a word that opens a sentence; the table does not. */
const asNumber = (word: string): number | undefined => WORDS[word.toLowerCase()]

const claimed = (pattern: RegExp): string => {
  const found = PLAN.match(pattern)
  // A missing claim is a failure too: the sentence this test guards was
  // edited or deleted, and an assertion that quietly matches nothing is the
  // thing this whole file exists to prevent.
  expect(found, `PLAN.md no longer contains ${String(pattern)}`).not.toBeNull()
  return found?.[1] ?? ''
}

/** Every `it(` under these paths — the same number vitest reports. */
const testsIn = (...paths: string[]): number => {
  const files: string[] = []
  const walk = (path: string): void => {
    for (const entry of readdirSync(root(path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`
      if (entry.isDirectory()) walk(child)
      else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
        files.push(child)
      }
    }
  }
  for (const path of paths) {
    if (path.endsWith('.ts')) files.push(path)
    else walk(path)
  }
  return files.reduce(
    (total, file) => total + (readFileSync(root(file), 'utf8').match(/(^|[^a-zA-Z.])it\(/g) ?? []).length,
    0,
  )
}

describe('The status board counts what is actually here (§X)', () => {
  it('knows how many migrations are written', () => {
    // The sentence changed shape when the deploy happened — "written and
    // unrun" stopped being true of all of them — and the count is still the
    // thing that goes stale, so it is still re-derived from the directory.
    const word = claimed(/\*\*([A-Za-z-]+) migrations\*\* are written/)
    const actual = readdirSync(root('supabase/migrations')).filter((f) => f.endsWith('.sql')).length
    expect(asNumber(word), `"${word}" is not a number this test knows`).toBe(actual)
  })

  it('knows how many edge functions there are', () => {
    const word = claimed(/deploy: [a-z-]+ migrations, ([a-z-]+) edge functions with/)
    // `_shared` is a module both functions import, not an endpoint anybody deploys.
    const actual = readdirSync(root('supabase/functions'), { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith('_'),
    ).length
    expect(asNumber(word)).toBe(actual)
  })
})

describe('The two remainder lists are counted, not estimated (§X)', () => {
  /** The `| D3 |` / `| S3 |` cells that open a row in each table. */
  const idsIn = (prefix: string): number[] =>
    [...PLAN.matchAll(new RegExp(`^\\| ${prefix}(\\d+) \\|`, 'gm'))].map((m) => Number(m[1]))

  it('says how many things are waiting on the deploy, and means it', () => {
    // The sentence this checks replaced a prose list that had been patched
    // from "two" to "a third now joins them" and was silently at ten.
    const word = claimed(/\*\*([A-Za-z-]+) separate items sat behind that one act\*\*/)
    expect(asNumber(word), `"${word}" is not a number this test knows`).toBe(idsIn('S').length)
  })

  it('numbers both lists from 1 with no gaps and no repeats', () => {
    for (const prefix of ['D', 'S']) {
      const ids = idsIn(prefix)
      expect(ids.length, `${prefix} list is empty`).toBeGreaterThan(0)
      expect(ids).toEqual([...ids].sort((a, b) => a - b))
      expect(new Set(ids).size, `${prefix} ids repeat`).toBe(ids.length)
      expect(ids[0]).toBe(1)
      expect(ids[ids.length - 1]).toBe(ids.length)
    }
  })
})

describe('The Phase 1 gate table counts what is actually here (§X)', () => {
  it('counts the denial suite', () => {
    const n = claimed(/— (\d+) tests in `supabase\/tests\/rls\.test\.ts`/)
    expect(Number(n)).toBe(testsIn('supabase/tests/rls.test.ts'))
  })

  it('counts the money and transition tests', () => {
    const n = claimed(/— (\d+) tests across `src\/domain\/\{money,documents,payments\}`/)
    expect(Number(n)).toBe(
      testsIn('src/domain/money', 'src/domain/documents', 'src/domain/payments'),
    )
  })

  it('counts the label tests', () => {
    const n = claimed(/— (\d+) tests in `src\/domain\/locale`/)
    expect(Number(n)).toBe(testsIn('src/domain/locale'))
  })
})
