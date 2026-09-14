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
  'twenty-four': 24, 'twenty-five': 25,
}

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
  it('knows how many migrations are written and unrun', () => {
    const word = claimed(/All ([a-z-]+) migrations and all [a-z-]+ edge functions are written and unrun/)
    const actual = readdirSync(root('supabase/migrations')).filter((f) => f.endsWith('.sql')).length
    expect(WORDS[word], `"${word}" is not a number this test knows`).toBe(actual)
  })

  it('knows how many edge functions there are', () => {
    const word = claimed(/All [a-z-]+ migrations and all ([a-z-]+) edge functions are written and unrun/)
    // `_shared` is a module both functions import, not an endpoint anybody deploys.
    const actual = readdirSync(root('supabase/functions'), { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith('_'),
    ).length
    expect(WORDS[word]).toBe(actual)
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
